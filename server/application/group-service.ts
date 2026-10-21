// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-006).
import type { ApiResult, CommandName, Commands, QueryName, Queries } from '../../src/application/api-contract';
import { failure, type CommandResult, type Context } from './context';
import { createInvite, listInvites, revokeInvite } from './invites';
import { listFeed } from './feed';
import {
  claimDuePushes,
  inbox,
  markRead,
  notificationSettings,
  pruneOutbox,
  removePushSubscriptions,
  setPrefs,
  subscribePush,
  unsubscribePush,
  type DuePushes,
} from './notifications';
import { listMembers, me, memberForSession, setRoles, signIn, signOut, type GoogleProfile, type Member, type SignInResult } from './members';
import type { Clock, IdGenerator, Sql } from './ports';
import { migrate } from './schema';

type Input = Record<string, unknown>;

/** Settings from the environment that some use cases show. */
export interface ServiceOptions {
  readonly pushPublicKey?: string | null;
}

type QueryContext = Context & { readonly options: ServiceOptions };

const QUERIES: { [N in QueryName]: (ctx: QueryContext, actor: Member, input: Input) => Queries[N]['output'] | null } = {
  me: (ctx, actor) => me(ctx, actor),
  members: (ctx) => listMembers(ctx),
  invites: (ctx, actor) => listInvites(ctx, actor),
  feed: (ctx, _actor, input) => listFeed(ctx, input),
  'notifications.inbox': (ctx, actor) => inbox(ctx, actor),
  'notifications.settings': (ctx, actor) => notificationSettings(ctx, actor, ctx.options.pushPublicKey || null),
};

const COMMANDS: { [N in CommandName]: (ctx: Context, actor: Member, input: Input) => CommandResult<Commands[N]['output']> } = {
  'invite.create': createInvite,
  'invite.revoke': revokeInvite,
  'member.setRoles': setRoles,
  'push.subscribe': subscribePush,
  'push.unsubscribe': unsubscribePush,
  'notifications.markRead': markRead,
  'notifications.setPrefs': setPrefs,
};

export class GroupService {
  private readonly ctx: QueryContext;

  constructor(sql: Sql, clock: Clock, ids: IdGenerator, options: ServiceOptions = {}) {
    this.ctx = { sql, clock, ids, options };
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

  query(sessionHash: string, name: string, input: unknown): ApiResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = handler(this.ctx, actor, asInput(input));
    return value === null ? failure('forbidden') : { ok: true, value };
  }

  command(sessionHash: string, name: string, input: unknown): CommandResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name as CommandName] : undefined;
    if (!handler) return failure('not_found');
    return this.ctx.sql.transaction(() => handler(this.ctx, actor, asInput(input)));
  }

  /**
   * Runs the time-based jobs that are due (ADR-006: one cron, every few minutes; the rules decide
   * what is due in America/Sao_Paulo). Monthly petiscos need no job: they are a quota per month.
   * Push delivery is not here: the Durable Object calls `claimDuePushes` after the tick.
   * Still to come (docs/ROADMAP.md): 7-day expiry notice, inheritance offer deadlines.
   */
  tick(): void {
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', this.ctx.clock.now().toISOString());
    pruneOutbox(this.ctx);
  }

  /** The pushes that are due (quiet hours, digest, grouped likes), marked sent; see notifications.ts. */
  claimDuePushes(maxPushes: number): DuePushes {
    return this.ctx.sql.transaction(() => claimDuePushes(this.ctx, maxPushes));
  }

  /** Forgets subscriptions the push service said are gone (404/410). */
  removePushSubscriptions(endpoints: readonly string[]): void {
    removePushSubscriptions(this.ctx, endpoints);
  }
}

function asInput(input: unknown): Input {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
}
