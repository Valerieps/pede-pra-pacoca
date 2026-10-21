// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-006).
import type { ApiResult, CommandName, Commands, QueryName, Queries, Topic } from '../../src/application/api-contract';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { createInvite, listInvites, revokeInvite } from './invites';
import { listFeed } from './feed';
import { listMembers, me, memberForSession, setRoles, signIn, signOut, type GoogleProfile, type Member, type SignInResult } from './members';
import type { Clock, IdGenerator, Sql } from './ports';
import {
  answerOffer,
  cancelRequest,
  createRequest,
  editNote,
  expireOffers,
  joinRequest,
  leaveRequest,
  manualAvailability,
  myRequests,
  previewMedia,
  requestDetail,
  searchMedia,
} from './requests';
import { migrate } from './schema';
import type { Prefetched } from './tmdb';

type Input = Record<string, unknown>;

/** `prefetched` is what the Worker looked up on TMDB first (./tmdb.ts); the app cannot set it. */
type Handler<T> = (ctx: Context, actor: Member, input: Input, prefetched: Prefetched) => T;

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output'] | QueryError | null> } = {
  me: (ctx, actor) => me(ctx, actor),
  members: (ctx) => listMembers(ctx),
  invites: (ctx, actor) => listInvites(ctx, actor),
  feed: (ctx, _actor, input) => listFeed(ctx, input),
  'media.search': searchMedia,
  'media.preview': previewMedia,
  'manual.availability': manualAvailability,
  'requests.mine': (ctx, actor) => myRequests(ctx, actor),
  'request.detail': requestDetail,
};

const COMMANDS: { [N in CommandName]: Handler<CommandResult<Commands[N]['output']>> } = {
  'invite.create': createInvite,
  'invite.revoke': revokeInvite,
  'member.setRoles': setRoles,
  'request.create': createRequest,
  'request.join': joinRequest,
  'request.leave': leaveRequest,
  'request.cancel': cancelRequest,
  'request.editNote': editNote,
  'request.answerOffer': answerOffer,
};

export class GroupService {
  private readonly ctx: Context;

  constructor(sql: Sql, clock: Clock, ids: IdGenerator) {
    this.ctx = { sql, clock, ids };
  }

  migrate(): void {
    migrate(this.ctx.sql);
  }

  signIn(profile: GoogleProfile, sessionHash: string, bootstrapAdminEmails: readonly string[]): SignInResult {
    return signIn(this.ctx, profile, sessionHash, bootstrapAdminEmails);
  }

  signOut(sessionHash: string): void {
    signOut(this.ctx, sessionHash);
  }

  memberForSession(sessionHash: string): Member | null {
    return memberForSession(this.ctx, sessionHash);
  }

  query(sessionHash: string, name: string, input: unknown, prefetched: Prefetched = {}): ApiResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = handler(this.ctx, actor, asInput(input), prefetched);
    if (value instanceof QueryError) return failure(value.error);
    return value === null ? failure('forbidden') : { ok: true, value };
  }

  command(sessionHash: string, name: string, input: unknown, prefetched: Prefetched = {}): CommandResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name as CommandName] : undefined;
    if (!handler) return failure('not_found');
    return this.ctx.sql.transaction(() => handler(this.ctx, actor, asInput(input), prefetched));
  }

  /**
   * Runs the time-based jobs that are due (ADR-006: one cron, every few minutes; the rules decide
   * what is due in America/Sao_Paulo). Monthly petiscos need no job: they are a quota per month.
   * Still to come (docs/ROADMAP.md): outbox delivery, daily digest, 7-day expiry notice.
   * Returns the topics that changed.
   */
  tick(): Topic[] {
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', this.ctx.clock.now().toISOString());
    const offersMoved = this.ctx.sql.transaction(() => expireOffers(this.ctx));
    return offersMoved ? ['requests', 'feed'] : [];
  }
}

function asInput(input: unknown): Input {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
}
