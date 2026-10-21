// Petiscos (docs/spec/petiscos.md): the balance and statement, the attendant's settings, bonus and
// manual cashback, and the 7-day expiry notice.
import type { PetiscoBalanceView, PetiscoMovementView, PetiscoSettingsView, PetiscoStatementView, Topic } from '../../src/application/api-contract';
import { canAttend } from '../../src/domain/group/roles';
import { canGiveManualCashback, DEFAULT_CASHBACK_SETTINGS } from '../../src/domain/petisco/cashback';
import { addDays } from '../../src/domain/time';
import {
  balanceOf,
  DEFAULT_MONTHLY_PETISCOS,
  EXPIRY_NOTICE_DAYS,
  expiringSoon,
  extraPetiscoExpiry,
  type PetiscoMovement,
} from '../../src/domain/petisco/ledger';
import { isBonusAmount, isMonthlyNumber, normalizeReason, parseCashbackSettings } from '../../src/domain/petisco/settings';
import { readConfig, writeConfig } from './config';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { recordFeedEvent } from './feed';
import { findMember, memberView, toMember, type Member, type MemberRow } from './members';

interface MovementRow {
  id: string;
  kind: PetiscoMovement['kind'];
  operation: PetiscoMovement['operation'];
  lot: string;
  request_id: string | null;
  expires_at: string | null;
  reason: string | null;
  at: string;
}

export function movementsOf(ctx: Context, memberId: string): PetiscoMovement[] {
  return ctx.sql
    .all<MovementRow>('SELECT * FROM petisco_movements WHERE member_id = ? ORDER BY at, rowid', memberId)
    .map((r) => ({ kind: r.kind, operation: r.operation, lot: r.lot, requestId: r.request_id, expiresAt: r.expires_at, at: r.at }));
}

export function groupMonthlyPetiscos(ctx: Context): number {
  return readConfig(ctx, 'monthlyPetiscos', DEFAULT_MONTHLY_PETISCOS);
}

/** The member's own number when the attendant set one, the group's otherwise. */
export function monthlyQuotaOf(ctx: Context, member: Member): number {
  return member.monthlyPetiscos ?? groupMonthlyPetiscos(ctx);
}

export function petiscoBalanceOf(ctx: Context, member: Member): PetiscoBalanceView {
  const balance = balanceOf(movementsOf(ctx, member.id), monthlyQuotaOf(ctx, member), ctx.clock.now());
  return {
    total: balance.total,
    monthlyAvailable: balance.monthly.available,
    monthlyQuota: balance.monthly.quota,
    renewsAt: balance.monthly.renewsAt,
    extras: balance.extras.map((e) => ({ kind: e.kind, expiresAt: e.expiresAt })),
  };
}

/** "O que eu vejo": the balance and every movement, newest first. */
export function petiscoStatement(ctx: Context, actor: Member): PetiscoStatementView {
  const movements = ctx.sql
    .all<MovementRow & { title: string | null }>(
      `SELECT petisco_movements.*, requests.title FROM petisco_movements
       LEFT JOIN requests ON requests.id = petisco_movements.request_id
       WHERE petisco_movements.member_id = ? ORDER BY petisco_movements.at DESC, petisco_movements.rowid DESC`,
      actor.id,
    )
    .map(
      (r): PetiscoMovementView => ({
        id: r.id,
        at: r.at,
        kind: r.kind,
        operation: r.operation,
        requestId: r.request_id,
        requestTitle: r.title,
        expiresAt: r.expires_at,
        reason: r.reason,
      }),
    );
  return { balance: petiscoBalanceOf(ctx, actor), movements };
}

interface CandidateRow extends MemberRow {
  request_id: string;
  title: string;
  fulfilled_at: string;
}

/** Fulfilled requests that debited a petisco and have no cashback yet (one cashback per request). */
const CASHBACK_CANDIDATES = `
  SELECT members.*, requests.id AS request_id, requests.title, requests.updated_at AS fulfilled_at
  FROM requests JOIN members ON members.id = requests.requester_id
  WHERE requests.status = 'fulfilled'
    AND EXISTS (SELECT 1 FROM petisco_movements d WHERE d.request_id = requests.id AND d.operation = 'debit')
    AND NOT EXISTS (SELECT 1 FROM petisco_movements c WHERE c.request_id = requests.id AND c.kind = 'cashback' AND c.operation = 'credit')`;

export const CASHBACK_CANDIDATES_SHOWN = 50;

export function petiscoSettings(ctx: Context, actor: Member): PetiscoSettingsView | null {
  if (!canAttend(actor)) return null;
  const members = ctx.sql
    .all<MemberRow>('SELECT * FROM members WHERE active = 1 ORDER BY name COLLATE NOCASE')
    .map(toMember)
    .map((m) => ({ ...memberView(m), monthlyPetiscos: m.monthlyPetiscos }));
  const cashbackCandidates = ctx.sql
    .all<CandidateRow>(`${CASHBACK_CANDIDATES} ORDER BY requests.updated_at DESC LIMIT ?`, CASHBACK_CANDIDATES_SHOWN)
    .map((r) => ({ requestId: r.request_id, title: r.title, requester: memberView(toMember(r)), fulfilledAt: r.fulfilled_at }));
  return {
    monthlyPetiscos: groupMonthlyPetiscos(ctx),
    cashback: readConfig(ctx, 'cashback', DEFAULT_CASHBACK_SETTINGS),
    members,
    cashbackCandidates,
  };
}

/** A new number changes balances at once: the monthly quota is computed, never stored. */
const BALANCE_TOPICS: readonly Topic[] = ['me', 'petiscos'];

export function setMonthly(ctx: Context, actor: Member, input: { petiscos?: unknown }): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  if (!isMonthlyNumber(input.petiscos)) return failure('invalid');
  writeConfig(ctx, 'monthlyPetiscos', input.petiscos);
  return { ok: true, value: null, changed: BALANCE_TOPICS };
}

export function setMemberMonthly(ctx: Context, actor: Member, input: { memberId?: unknown; petiscos?: unknown }): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  if (typeof input.memberId !== 'string' || (input.petiscos !== null && !isMonthlyNumber(input.petiscos))) return failure('invalid');
  const target = findMember(ctx, input.memberId);
  if (!target || !target.active) return failure('not_found');
  ctx.sql.run('UPDATE members SET monthly_petiscos = ? WHERE id = ?', input.petiscos, target.id);
  return { ok: true, value: null, changed: BALANCE_TOPICS };
}

export function setCashback(ctx: Context, actor: Member, input: unknown): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  const settings = parseCashbackSettings(input);
  if (!settings) return failure('invalid');
  writeConfig(ctx, 'cashback', settings);
  return { ok: true, value: null, changed: ['petiscos'] };
}

function creditExtra(
  ctx: Context,
  input: { memberId: string; kind: 'bonus' | 'cashback'; requestId: string | null; reason: string | null; actorId: string },
): void {
  const id = ctx.ids.next();
  ctx.sql.run(
    `INSERT INTO petisco_movements (id, member_id, kind, operation, lot, request_id, expires_at, reason, actor, at)
     VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, ?, ?)`,
    id,
    input.memberId,
    input.kind,
    id,
    input.requestId,
    extraPetiscoExpiry(ctx.clock.now()),
    input.reason,
    input.actorId,
    nowIso(ctx),
  );
}

/** Bonus to anyone, with an optional reason. Each petisco is its own lot with its own 90 days. No feed event. */
export function giveBonus(ctx: Context, actor: Member, input: { memberId?: unknown; amount?: unknown; reason?: unknown }): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  const reason = normalizeReason(input.reason);
  if (typeof input.memberId !== 'string' || !isBonusAmount(input.amount) || reason === undefined) return failure('invalid');
  const target = findMember(ctx, input.memberId);
  if (!target || !target.active) return failure('not_found');
  for (let i = 0; i < input.amount; i++) creditExtra(ctx, { memberId: target.id, kind: 'bonus', requestId: null, reason, actorId: actor.id });
  notifyPetiscoReceived(ctx, { memberId: target.id, kind: 'bonus', amount: input.amount });
  return { ok: true, value: null, changed: BALANCE_TOPICS };
}

/** Manual cashback on a fulfilled request that debited a petisco, at most one per request. */
export function giveCashback(ctx: Context, actor: Member, input: { requestId?: unknown; reason?: unknown }): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  const reason = normalizeReason(input.reason);
  if (typeof input.requestId !== 'string' || reason === undefined) return failure('invalid');
  const [request] = ctx.sql.all<{ id: string; status: string; requester_id: string }>(
    'SELECT id, status, requester_id FROM requests WHERE id = ?',
    input.requestId,
  );
  if (!request) return failure('not_found');
  const has = (where: string) => ctx.sql.all(`SELECT 1 FROM petisco_movements WHERE request_id = ? AND ${where}`, request.id).length > 0;
  const context = { coRequesterCount: 0, debitedPetisco: has("operation = 'debit'"), alreadyGotCashback: has("kind = 'cashback' AND operation = 'credit'") };
  if (request.status !== 'fulfilled' || !canGiveManualCashback(context)) return failure('conflict');

  creditExtra(ctx, { memberId: request.requester_id, kind: 'cashback', requestId: request.id, reason, actorId: actor.id });
  recordFeedEvent(ctx, { type: 'cashback', actorId: request.requester_id, requestId: request.id });
  notifyPetiscoReceived(ctx, { memberId: request.requester_id, kind: 'cashback', amount: 1 });
  return { ok: true, value: null, changed: [...BALANCE_TOPICS, 'feed'] };
}

/**
 * Job for `tick()`: warns each owner, once per lot, of the bonus and cashback still available that
 * expire within 7 days. One notice per member and run, with how many and the soonest expiry.
 */
export function warnExpiringPetiscos(ctx: Context): void {
  const now = ctx.clock.now();
  const owners = ctx.sql.all<MemberRow>(
    `SELECT DISTINCT members.* FROM petisco_movements JOIN members ON members.id = petisco_movements.member_id
     WHERE members.active = 1 AND petisco_movements.operation = 'credit' AND petisco_movements.kind IN ('bonus', 'cashback')
       AND petisco_movements.expires_at > ? AND petisco_movements.expires_at <= ?
       AND petisco_movements.lot NOT IN (SELECT lot FROM petisco_expiry_notices)`,
    now.toISOString(),
    addDays(now, EXPIRY_NOTICE_DAYS).toISOString(),
  );
  for (const owner of owners.map(toMember)) {
    const warned = new Set(ctx.sql.all<{ lot: string }>('SELECT lot FROM petisco_expiry_notices WHERE member_id = ?', owner.id).map((r) => r.lot));
    const balance = balanceOf(movementsOf(ctx, owner.id), monthlyQuotaOf(ctx, owner), now);
    const lots = expiringSoon(balance, now).filter((e) => !warned.has(e.lot));
    if (lots.length === 0) continue;
    for (const lot of lots) {
      ctx.sql.run('INSERT INTO petisco_expiry_notices (lot, member_id, notified_at) VALUES (?, ?, ?)', lot.lot, owner.id, now.toISOString());
    }
    notifyPetiscoExpiring(ctx, { memberId: owner.id, amount: lots.length, expiresAt: lots[0].expiresAt });
  }
}

// Notification call sites. The notification slice (outbox, inbox, Web Push) is not in main yet:
// when it lands, these call its `notify` with the triggers "petisco_received" and
// "petisco_expiring" (docs/spec/notificacoes.md; the gap is listed in docs/ROADMAP.md).

function notifyPetiscoReceived(_ctx: Context, _notice: { memberId: string; kind: 'bonus' | 'cashback'; amount: number }): void {
  // Wiring pending: notify(ctx, { type: 'petisco_received', subjectId: memberId, data: { kind, amount } }).
}

function notifyPetiscoExpiring(_ctx: Context, _notice: { memberId: string; amount: number; expiresAt: string }): void {
  // Wiring pending: notify(ctx, { type: 'petisco_expiring', subjectId: memberId, data: { amount, expiresAt } }).
}
