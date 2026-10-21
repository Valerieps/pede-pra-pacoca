// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-006).
import type { ApiResult, CommandName, Commands, QueryName, Queries, Topic } from '../../src/application/api-contract';
import { failure, type CommandResult, type Context } from './context';
import { createInvite, listInvites, revokeInvite } from './invites';
import { exportGroup } from './export';
import { listFeed } from './feed';
import { listMembers, me, memberForSession, setRoles, signIn, signOut, updateProfile, type GoogleProfile, type Member, type SignInResult } from './members';
import { giveBonus, giveCashback, petiscoSettings, petiscoStatement, setCashback, setMemberMonthly, setMonthly, warnExpiringPetiscos } from './petiscos';
import type { Clock, IdGenerator, Sql } from './ports';
import { migrate } from './schema';
import { endFinishedVacations, setVacation, vacationView } from './vacation';

type Input = Record<string, unknown>;

const QUERIES: { [N in QueryName]: (ctx: Context, actor: Member, input: Input) => Queries[N]['output'] | null } = {
  me: (ctx, actor) => me(ctx, actor),
  members: (ctx, actor) => listMembers(ctx, actor),
  invites: (ctx, actor) => listInvites(ctx, actor),
  feed: (ctx, _actor, input) => listFeed(ctx, input),
  'petiscos.statement': (ctx, actor) => petiscoStatement(ctx, actor),
  'petiscos.settings': (ctx, actor) => petiscoSettings(ctx, actor),
  vacation: (ctx, actor) => vacationView(ctx, actor),
  'group.export': (ctx, actor) => exportGroup(ctx, actor),
};

const COMMANDS: { [N in CommandName]: (ctx: Context, actor: Member, input: Input) => CommandResult<Commands[N]['output']> } = {
  'invite.create': createInvite,
  'invite.revoke': revokeInvite,
  'member.setRoles': setRoles,
  'member.updateProfile': updateProfile,
  'petiscos.setMonthly': setMonthly,
  'petiscos.setMemberMonthly': setMemberMonthly,
  'petiscos.setCashback': setCashback,
  'petiscos.giveBonus': giveBonus,
  'petiscos.giveCashback': giveCashback,
  'vacation.set': setVacation,
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
   * Returns the topics that changed, for the open apps.
   * Still to come (docs/ROADMAP.md): outbox delivery, daily digest, inheritance offer deadlines.
   */
  tick(): Topic[] {
    const changed: Topic[] = [];
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', this.ctx.clock.now().toISOString());
    this.ctx.sql.transaction(() => warnExpiringPetiscos(this.ctx));
    if (this.ctx.sql.transaction(() => endFinishedVacations(this.ctx))) changed.push('vacation');
    return changed;
  }
}

function asInput(input: unknown): Input {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
}
