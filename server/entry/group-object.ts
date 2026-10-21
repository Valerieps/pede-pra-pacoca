// The one Durable Object that holds the whole group (ADR-006): its SQLite database, and the live
// WebSocket connections of every open app. Calls are processed one at a time, so each command
// runs alone; its writes commit in one transaction.
import { DurableObject } from 'cloudflare:workers';
import type { LiveMessage, Topic } from '../../src/application/api-contract';
import { GroupService } from '../application/group-service';
import type { GoogleProfile, SignInResult } from '../application/members';
import type { Prefetched } from '../application/tmdb';
import { durableObjectSql } from '../infrastructure/durable-object-sql';
import { pushSender, sendAll, type PushSender } from '../infrastructure/web-push';
import type { Env } from './env';

export const SESSION_HASH_HEADER = 'x-pacoca-session-hash';

/**
 * Pushes per delivery. Workers Free gives little CPU per call (ADR-006) and each push is one
 * encryption, so a command sends a few and the 5-minute cron the rest (ADR-011).
 */
const PUSHES_AFTER_COMMAND = 5;
const PUSHES_PER_TICK = 10;

export class Group extends DurableObject<Env> {
  private readonly service: GroupService;
  private readonly push: PushSender | null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.service = new GroupService(
      durableObjectSql(ctx.storage),
      { now: () => new Date() },
      { next: () => crypto.randomUUID() },
      { pushPublicKey: env.VAPID_PUBLIC_KEY || null },
    );
    const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
    this.push = publicKey && privateKey && subject ? pushSender({ publicKey, privateKey, subject }) : null;
    void ctx.blockConcurrencyWhile(async () => this.service.migrate());
  }

  signIn(profile: GoogleProfile, sessionHash: string, bootstrapAdminEmails: string[]): SignInResult {
    return this.service.signIn(profile, sessionHash, bootstrapAdminEmails);
  }

  signOut(sessionHash: string): void {
    this.service.signOut(sessionHash);
  }

  /** Lets the Worker refuse a TMDB lookup before spending it on someone signed out. */
  isSignedIn(sessionHash: string): boolean {
    return this.service.memberForSession(sessionHash) !== null;
  }

  query(sessionHash: string, name: string, input: unknown, prefetched: Prefetched = {}) {
    return this.service.query(sessionHash, name, input, prefetched);
  }

  command(sessionHash: string, name: string, input: unknown, prefetched: Prefetched = {}) {
    const result = this.service.command(sessionHash, name, input, prefetched);
    if (result.ok && result.changed.length > 0) this.broadcast(result.changed);
    // A removed member's open apps lose the live connection now; their sessions are already gone.
    if (result.ok) for (const memberId of result.disconnect ?? []) this.disconnect(memberId);
    // A command that notified someone: send what is due now instead of waiting for the cron.
    if (result.ok && result.changed.includes('notifications')) this.ctx.waitUntil(this.deliver(PUSHES_AFTER_COMMAND));
    return result;
  }

  async tick(): Promise<void> {
    const changed = this.service.tick();
    if (changed.length > 0) this.broadcast(changed);
    await this.deliver(PUSHES_PER_TICK);
  }

  /** Claims the due pushes (marked sent at once, so no call sends them twice) and sends them. */
  private async deliver(max: number): Promise<void> {
    const { jobs, inboxChanged } = this.service.claimDuePushes(max);
    if (inboxChanged) this.broadcast(['notifications']);
    if (jobs.length === 0) return;
    if (!this.push) {
      console.warn('push not configured (VAPID_* secrets); notices reached the inbox only');
      return;
    }
    const gone = await sendAll(this.push, jobs);
    if (gone.length > 0) this.service.removePushSubscriptions(gone);
  }

  /** Live connection: the Worker already checked the origin and passes the session hash. */
  override async fetch(request: Request): Promise<Response> {
    const member = this.service.memberForSession(request.headers.get(SESSION_HASH_HEADER) ?? '');
    if (!member) return new Response(null, { status: 401 });
    const pair = new WebSocketPair();
    // Hibernation API: idle connections cost nothing; the tag finds a member's sockets.
    this.ctx.acceptWebSocket(pair[1], [member.id]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketMessage(): void {
    // The app never sends anything but keep-alives; commands go through HTTP.
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    ws.close(code === 1005 ? 1000 : code);
  }

  private disconnect(memberId: string): void {
    for (const ws of this.ctx.getWebSockets(memberId)) {
      try {
        ws.close(4401, 'removed');
      } catch {
        // Already closing.
      }
    }
  }

  private broadcast(topics: readonly Topic[]): void {
    const message: LiveMessage = { type: 'changed', topics };
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // A closing socket; the app reconnects and refetches on its own.
      }
    }
  }
}
