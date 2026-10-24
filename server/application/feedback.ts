// "Dar retorno" (docs/spec/pedidos.md): on an Cãopleto request, any member sends "Obrigada, Paçoca"
// once to the attendant who fulfilled it.
import type { FeedbackView } from '../../src/application/api-contract';
import { fulfillingAttendant, type RequestStatus } from '../../src/domain/request/lifecycle';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { recordFeedEvent } from './feed';
import type { Member } from './members';
import { notify } from './notifications';
import { findRequest } from './requests';

type Input = Record<string, unknown>;

interface FeedbackRow {
  thanked_at: string | null;
}

function feedbackRow(ctx: Context, requestId: string, memberId: string): FeedbackRow | null {
  const [row] = ctx.sql.all<FeedbackRow>('SELECT thanked_at FROM feedback WHERE request_id = ? AND member_id = ?', requestId, memberId);
  return row ?? null;
}

/** What I already said about a request. */
export function feedbackOf(ctx: Context, requestId: string, memberId: string): FeedbackView {
  const row = feedbackRow(ctx, requestId, memberId);
  return { thanked: row?.thanked_at != null };
}

/** "Obrigada, Paçoca", once per member per request, to the attendant who fulfilled it. */
export function thank(ctx: Context, actor: Member, input: Input): CommandResult<FeedbackView> {
  const request = findRequest(ctx, input.id);
  if (!request) return failure('not_found');
  if (request.status !== 'fulfilled' || feedbackRow(ctx, request.id, actor.id)?.thanked_at) return failure('conflict');

  ctx.sql.run(
    `INSERT INTO feedback (request_id, member_id, thanked_at) VALUES (?, ?, ?)
     ON CONFLICT (request_id, member_id) DO UPDATE SET thanked_at = excluded.thanked_at`,
    request.id,
    actor.id,
    nowIso(ctx),
  );
  recordFeedEvent(ctx, { type: 'thanked', actorId: actor.id, requestId: request.id });
  const transitions = ctx.sql
    .all<{ to_status: RequestStatus; member_id: string | null }>(
      `SELECT t.to_status, members.id AS member_id FROM request_transitions t LEFT JOIN members ON members.id = t.actor
       WHERE t.request_id = ? ORDER BY t.id`,
      request.id,
    )
    .map((t) => ({ to: t.to_status, actorId: t.member_id }));
  const attendantId = fulfillingAttendant(request.assignee_id, transitions);
  notify(ctx, { type: 'thanked', data: { requestId: request.id, title: request.title, memberName: actor.name }, subjectId: attendantId, actorId: actor.id });
  return { ok: true, value: feedbackOf(ctx, request.id, actor.id), changed: ['requests', 'feed', 'notifications'] };
}
