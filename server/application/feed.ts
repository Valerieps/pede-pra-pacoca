// The group's public timeline (docs/spec/feed.md).
import type { FeedEventType, FeedEventView } from '../../src/application/api-contract';
import { nowIso, type Context } from './context';
import { memberView, toMember, type MemberRow } from './members';

export const FEED_PAGE_SIZE = 30;

export function recordFeedEvent(ctx: Context, event: { type: FeedEventType; actorId: string; requestId: string | null; data?: object }): string {
  const id = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO feed_events (id, type, actor_id, request_id, data, at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    event.type,
    event.actorId,
    event.requestId,
    JSON.stringify(event.data ?? {}),
    nowIso(ctx),
  );
  return id;
}

interface FeedRow extends MemberRow {
  event_id: string;
  type: FeedEventType;
  request_id: string | null;
  request_title: string | null;
  like_count: number;
  at: string;
}

/** Most recent first; `before` is the `at` of the last event already shown. */
export function listFeed(ctx: Context, input: { before?: unknown }): FeedEventView[] {
  const before = typeof input.before === 'string' ? input.before : '9999';
  return ctx.sql
    .all<FeedRow>(
      `SELECT members.*, feed_events.id AS event_id, feed_events.type, feed_events.request_id,
              requests.title AS request_title, feed_events.like_count, feed_events.at
       FROM feed_events JOIN members ON members.id = feed_events.actor_id
       LEFT JOIN requests ON requests.id = feed_events.request_id
       WHERE feed_events.at < ? ORDER BY feed_events.at DESC, feed_events.id DESC LIMIT ?`,
      before,
      FEED_PAGE_SIZE,
    )
    .map((row) => ({
      id: row.event_id,
      type: row.type,
      actor: memberView(toMember(row)),
      requestId: row.request_id,
      requestTitle: row.request_title,
      at: row.at,
      likeCount: row.like_count,
    }));
}

/** Takes a request's events off the feed, likes included: all of them, or one type by one actor. */
export function removeFeedEvents(ctx: Context, requestId: string, only?: { type: FeedEventType; actorId: string }): void {
  const where = only ? 'request_id = ? AND type = ? AND actor_id = ?' : 'request_id = ?';
  const bindings = only ? [requestId, only.type, only.actorId] : [requestId];
  ctx.sql.run(`DELETE FROM likes WHERE event_id IN (SELECT id FROM feed_events WHERE ${where})`, ...bindings);
  ctx.sql.run(`DELETE FROM feed_events WHERE ${where}`, ...bindings);
}
