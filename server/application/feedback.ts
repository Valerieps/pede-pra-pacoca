// "Dar retorno" (docs/spec/pedidos.md): on an Cãopleto request, any member marks "Assisti" with an
// optional rating and sends "Obrigada, Paçoca" to the attendant who fulfilled it. Each one goes to
// the feed once per member; changing the rating later updates the same event.
import type { FeedbackView } from '../../src/application/api-contract';
import { fulfillingAttendant, isRating, type RequestStatus } from '../../src/domain/request/lifecycle';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { recordFeedEvent } from './feed';
import type { Member } from './members';
import { notify } from './notifications';
import { findRequest } from './requests';

type Input = Record<string, unknown>;

interface FeedbackRow {
  watched_at: string | null;
  rating: number | null;
  thanked_at: string | null;
}

function feedbackRow(ctx: Context, requestId: string, memberId: string): FeedbackRow | null {
  const [row] = ctx.sql.all<FeedbackRow>('SELECT watched_at, rating, thanked_at FROM feedback WHERE request_id = ? AND member_id = ?', requestId, memberId);
  return row ?? null;
}

/** What I already said about a request. */
export function feedbackOf(ctx: Context, requestId: string, memberId: string): FeedbackView {
  const row = feedbackRow(ctx, requestId, memberId);
  return { watched: row?.watched_at != null, rating: row?.rating ?? null, thanked: row?.thanked_at != null };
}

/** "Assisti", with a rating from 1 to 5 or none. `rating` left out keeps the one I gave. */
export function markWatched(ctx: Context, actor: Member, input: Input): CommandResult<FeedbackView> {
  const request = findRequest(ctx, input.id);
  if (!request) return failure('not_found');
  if (input.rating !== undefined && input.rating !== null && !isRating(input.rating)) return failure('invalid');
  if (request.status !== 'fulfilled') return failure('conflict');

  const before = feedbackRow(ctx, request.id, actor.id);
  const rating = input.rating === undefined ? (before?.rating ?? null) : (input.rating as number | null);
  ctx.sql.run(
    `INSERT INTO feedback (request_id, member_id, watched_at, rating) VALUES (?, ?, ?, ?)
     ON CONFLICT (request_id, member_id) DO UPDATE SET watched_at = COALESCE(feedback.watched_at, excluded.watched_at), rating = excluded.rating`,
    request.id,
    actor.id,
    nowIso(ctx),
    rating,
  );
  if (before?.watched_at) {
    ctx.sql.run("UPDATE feed_events SET data = ? WHERE request_id = ? AND actor_id = ? AND type = 'watched'", JSON.stringify({ rating }), request.id, actor.id);
  } else {
    recordFeedEvent(ctx, { type: 'watched', actorId: actor.id, requestId: request.id, data: { rating } });
  }
  return { ok: true, value: feedbackOf(ctx, request.id, actor.id), changed: ['requests', 'feed'] };
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
