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
  like_count: number;
  at: string;
}

/** Most recent first; `before` is the `at` of the last event already shown. */
export function listFeed(ctx: Context, input: { before?: unknown }): FeedEventView[] {
  const before = typeof input.before === 'string' ? input.before : '9999';
  return ctx.sql
    .all<FeedRow>(
      `SELECT members.*, feed_events.id AS event_id, feed_events.type, feed_events.request_id,
              feed_events.like_count, feed_events.at
       FROM feed_events JOIN members ON members.id = feed_events.actor_id
       WHERE feed_events.at < ? ORDER BY feed_events.at DESC, feed_events.id DESC LIMIT ?`,
      before,
      FEED_PAGE_SIZE,
    )
    .map((row) => ({
      id: row.event_id,
      type: row.type,
      actor: memberView(toMember(row)),
      requestId: row.request_id,
      at: row.at,
      likeCount: row.like_count,
    }));
}
