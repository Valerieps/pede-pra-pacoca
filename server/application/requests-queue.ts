// The attendant's queues and status changes (docs/spec/atendente.md). Every change goes through
// the domain's `transition`, and its effects (petiscos, feed, notices, cashback) are applied in
// the command's transaction by requests.ts.
import type { AttendantActionResult, QueuesView, RequestView } from '../../src/application/api-contract';
import { canAttend } from '../../src/domain/group/roles';
import { ACTIVE_STATUSES, transition, type Reason, type RequestAction } from '../../src/domain/request/lifecycle';
import { queueOf } from '../../src/domain/request/queue';
import { parseFulfillmentNote, parseReason } from '../../src/domain/request/reason';
import { readConfig } from './config';
import { failure, nowIso, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { applyEffects, findRequest, openOffer, setStatus, stateOf, toViews, type RequestRow } from './requests';

/** What an attendant does; cancel belongs to the requester. */
type Action = Exclude<RequestAction, { type: 'cancel' }>;

/** The most requests one batch may change. */
export const MAX_BATCH = 50;

const ACTIVE_SQL = ACTIVE_STATUSES.map((s) => `'${s}'`).join(', ');

/**
 * Every active request, oldest first, in its queue. A request being offered to its co-requesters
 * after a cancel stays out until someone takes it (docs/spec/atendente.md).
 */
export function queues(ctx: Context, actor: Member): QueuesView | null {
  if (!canAttend(actor)) return null;
  const rows = ctx.sql.all<RequestRow>(
    `SELECT * FROM requests WHERE status IN (${ACTIVE_SQL})
       AND id NOT IN (SELECT request_id FROM inheritance_offers WHERE state = 'pending')
     ORDER BY created_at, id`,
  );
  const view = { awaiting: [] as RequestView[], toSend: [] as RequestView[], inJellyseerr: [] as RequestView[], manual: [] as RequestView[] };
  for (const request of toViews(ctx, rows)) {
    const queue = queueOf(request);
    if (queue) view[queue].push(request);
  }
  return { ...view, jellyseerrBaseUrl: readConfig(ctx, 'jellyseerrBaseUrl', null) };
}

/** Reads the action from untrusted input; null when invalid. */
function readAction(value: unknown): Action | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case 'assign':
    case 'approve':
    case 'mark_sent':
      return { type: input.type };
    case 'reject':
    case 'mark_unavailable': {
      const reason = parseReason(input.reason);
      return reason ? { type: input.type, reason } : null;
    }
    case 'mark_fulfilled': {
      const note = parseFulfillmentNote(input.note);
      if (note === undefined) return null;
      return note ? { type: 'mark_fulfilled', note } : { type: 'mark_fulfilled' };
    }
    default:
      return null;
  }
}

function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH) return null;
  if (!value.every((id) => typeof id === 'string')) return null;
  return [...new Set(value as string[])];
}

/** Applies one action to one request. False when the request is not in a state that allows it. */
function act(ctx: Context, actor: Member, row: RequestRow, action: Action): boolean {
  if (openOffer(ctx, row.id)) return false;
  if (action.type === 'assign' && row.assignee_id === actor.id) return false;
  const result = transition(stateOf(ctx, row), action, { kind: 'member', id: actor.id, canAttend: true });
  if (!result.ok) return false;

  const reason: Reason | null = 'reason' in action ? action.reason : null;
  const note = action.type === 'mark_fulfilled' ? (action.note ?? null) : null;
  ctx.sql.run('UPDATE requests SET assignee_id = ?, updated_at = ? WHERE id = ?', result.next.assigneeId, nowIso(ctx), row.id);
  if (reason) ctx.sql.run('UPDATE requests SET reason_code = ?, reason_text = ? WHERE id = ?', reason.code, reason.text ?? null, row.id);
  if (note) ctx.sql.run('UPDATE requests SET fulfillment_note = ? WHERE id = ?', note, row.id);

  if (action.type === 'assign') {
    setStatus(ctx, row.id, row.status, row.status, actor.id, 'assigned');
  } else {
    const extra = { ...(reason ? { reason } : {}), ...(note ? { note } : {}) };
    setStatus(ctx, row.id, row.status, result.next.status, actor.id, undefined, extra);
  }
  applyEffects(ctx, { id: row.id, requesterId: row.requester_id, title: row.title }, result.effects, actor.id, { reason, note });
  return true;
}

/**
 * "Eu pego esse", approve, reject, "Enviado", Cãopleto and "Não foi possível", on one request or a
 * batch. A request that changed in the meantime (or never allowed it) is skipped, not an error.
 */
export function actOnRequests(ctx: Context, actor: Member, input: { ids?: unknown; action?: unknown }): CommandResult<AttendantActionResult> {
  if (!canAttend(actor)) return failure('forbidden');
  const ids = readIds(input.ids);
  const action = readAction(input.action);
  if (!ids || !action) return failure('invalid');

  const applied: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const row = findRequest(ctx, id);
    (row && act(ctx, actor, row, action) ? applied : skipped).push(id);
  }
  return {
    ok: true,
    value: { applied, skipped },
    changed: applied.length > 0 ? ['requests', 'feed', 'me', 'petiscos', 'notifications'] : [],
  };
}
