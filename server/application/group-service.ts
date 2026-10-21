// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-006).
import type { ApiResult, CommandName, Commands, QueryName, Queries, Topic } from '../../src/application/api-contract';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { createInvite, listInvites, revokeInvite } from './invites';
import { listFeed, listLikes, toggleLike } from './feed';
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
import { listMembers, me, memberForSession, setRoles, signIn, signOut, updateProfile, type GoogleProfile, type Member, type SignInResult } from './members';
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

/** Settings from the environment that some use cases show. */
export interface ServiceOptions {
  readonly pushPublicKey?: string | null;
}

type ServiceContext = Context & { readonly options: ServiceOptions };

/** `prefetched` is what the Worker looked up on TMDB first (./tmdb.ts); the app cannot set it. */
type Handler<T> = (ctx: ServiceContext, actor: Member, input: Input, prefetched: Prefetched) => T;

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output'] | QueryError | null> } = {
  me: (ctx, actor) => me(ctx, actor),
  members: (ctx, actor) => listMembers(ctx, actor),
  invites: (ctx, actor) => listInvites(ctx, actor),
  feed: (ctx, actor, input) => listFeed(ctx, actor, input),
  'feed.likes': (ctx, _actor, input) => listLikes(ctx, input),
  'notifications.inbox': (ctx, actor) => inbox(ctx, actor),
  'notifications.settings': (ctx, actor) => notificationSettings(ctx, actor, ctx.options.pushPublicKey || null),
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
  'push.subscribe': subscribePush,
  'push.unsubscribe': unsubscribePush,
  'notifications.markRead': markRead,
  'notifications.setPrefs': setPrefs,
  'request.create': createRequest,
  'request.join': joinRequest,
  'request.leave': leaveRequest,
  'request.cancel': cancelRequest,
  'request.editNote': editNote,
  'request.answerOffer': answerOffer,
  'member.updateProfile': updateProfile,
  'feed.toggleLike': toggleLike,
};

export class GroupService {
  private readonly ctx: ServiceContext;

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
   * Push delivery is not here: the Durable Object calls `claimDuePushes` after the tick.
   * Still to come (docs/ROADMAP.md): 7-day expiry notice. Returns the topics that changed.
   */
  tick(): Topic[] {
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', this.ctx.clock.now().toISOString());
    pruneOutbox(this.ctx);
    const offersMoved = this.ctx.sql.transaction(() => expireOffers(this.ctx));
    return offersMoved ? ['requests', 'feed'] : [];
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
