// Removing a member (docs/spec/grupo-e-papeis.md, "Remover membro"). Her active requests are
// handled as cancelled by her, she leaves the ones she also wanted, and her access ends at once.
// Her history stays: feed events, fulfilled requests, petisco movements. A new invite brings her
// back (members.ts, signIn).
import { isAdmin, keepsAnAdmin } from '../../src/domain/group/roles';
import { ACTIVE_STATUSES, requesterRemoved } from '../../src/domain/request/lifecycle';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { activeAdminIds, findMember, type Member } from './members';
import { applyEffects, offerToNext, openOffer, setStatus, stateOf, type RequestRow } from './requests';
import { removeFeedEvents } from './feed';

const ACTIVE_SQL = ACTIVE_STATUSES.map((s) => `'${s}'`).join(', ');

/** Admins only; nobody removes themself, so the last admin always stays. */
export function removeMember(ctx: Context, actor: Member, input: { memberId?: unknown }): CommandResult<null> {
  if (!isAdmin(actor)) return failure('forbidden');
  if (typeof input.memberId !== 'string') return failure('invalid');
  if (input.memberId === actor.id) return failure('forbidden');
  const target = findMember(ctx, input.memberId);
  if (!target || !target.active) return failure('not_found');
  if (isAdmin(target) && !keepsAnAdmin(activeAdminIds(ctx), target.id)) return failure('last_admin');

  leaveCoRequests(ctx, target.id);
  cancelOwnRequests(ctx, target.id);
  // Requests she had taken go back to the queue for the other attendants.
  ctx.sql.run(`UPDATE requests SET assignee_id = NULL WHERE assignee_id = ? AND status IN (${ACTIVE_SQL})`, target.id);

  ctx.sql.run('UPDATE members SET active = 0, removed_at = ?, vacation = 0, vacation_until = NULL WHERE id = ?', nowIso(ctx), target.id);
  ctx.sql.run('DELETE FROM sessions WHERE member_id = ?', target.id);
  ctx.sql.run('DELETE FROM push_subscriptions WHERE member_id = ?', target.id);
  return {
    ok: true,
    value: null,
    changed: ['members', 'requests', 'feed', 'me', 'notifications', 'petiscos', 'vacation'],
    disconnect: [target.id],
  };
}

/** Like "Não quero mais" on each active request; an offer made to her passes on. */
function leaveCoRequests(ctx: Context, memberId: string): void {
  const ids = ctx.sql
    .all<{ id: string }>(
      `SELECT requests.id FROM co_requests JOIN requests ON requests.id = co_requests.request_id
       WHERE co_requests.member_id = ? AND requests.status IN (${ACTIVE_SQL})`,
      memberId,
    )
    .map((r) => r.id);
  for (const id of ids) {
    ctx.sql.run('DELETE FROM co_requests WHERE request_id = ? AND member_id = ?', id, memberId);
    const offer = openOffer(ctx, id);
    if (offer?.member_id === memberId) {
      ctx.sql.run("UPDATE inheritance_offers SET state = 'withdrawn' WHERE id = ?", offer.id);
      offerToNext(ctx, id);
    }
  }
}

/** Her active requests, as if she cancelled each one; those already on offer keep their offer. */
function cancelOwnRequests(ctx: Context, memberId: string): void {
  const rows = ctx.sql.all<RequestRow>(`SELECT * FROM requests WHERE requester_id = ? AND status IN (${ACTIVE_SQL}) ORDER BY created_at`, memberId);
  for (const row of rows) {
    if (openOffer(ctx, row.id)) continue;
    const { next, effects } = requesterRemoved(stateOf(ctx, row));
    const offered = effects.some((e) => e.type === 'offer_to_co_requesters');
    ctx.sql.run('UPDATE requests SET petisco_lot = ? WHERE id = ?', next.petiscoLot, row.id);
    setStatus(ctx, row.id, row.status, next.status, memberId, offered ? 'offered_to_co_requesters' : 'requester_removed');
    applyEffects(ctx, { id: row.id, requesterId: row.requester_id, title: row.title }, effects, memberId);
    if (next.status === 'canceled') removeFeedEvents(ctx, row.id);
  }
}
