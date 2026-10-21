// The group's public timeline and its likes (docs/spec/feed.md).
import type { FeedEventType, FeedEventView, LikeToggleView, MemberView } from '../../src/application/api-contract';
import { FEED_PAGE_SIZE, toFeedFilter } from '../../src/domain/feed/feed';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { memberView, toMember, type Member, type MemberRow } from './members';
import { notify } from './notifications';

const REQUEST_EVENTS: readonly FeedEventType[] = ['request_created', 'co_request'];

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
  request_poster_path: string | null;
  like_count: number;
  liked_by_me: number;
  data: string;
  at: string;
}

/**
 * Most recent first, one page at a time. `before` and `beforeId` are the `at` and the `id` of the
 * last event already shown; `beforeId` breaks ties between events recorded in the same instant.
 */
export function listFeed(ctx: Context, actor: Member, input: { before?: unknown; beforeId?: unknown; filter?: unknown }): FeedEventView[] {
  const before = typeof input.before === 'string' ? input.before : '9999';
  const beforeId = typeof input.beforeId === 'string' ? input.beforeId : null;
  const filter = toFeedFilter(input.filter);

  const where = [beforeId === null ? 'e.at < ?' : '(e.at < ? OR (e.at = ? AND e.id < ?))'];
  const bindings: (string | number)[] = beforeId === null ? [before] : [before, before, beforeId];
  if (filter === 'requests') {
    where.push(`e.type IN (${REQUEST_EVENTS.map(() => '?').join(', ')})`);
    bindings.push(...REQUEST_EVENTS);
  } else if (filter === 'fulfilled') {
    where.push("e.type = 'request_fulfilled'");
  } else if (filter === 'mine') {
    // Mine: what I did, and anything about a request I asked for or also want.
    where.push(`(e.actor_id = ?
      OR e.request_id IN (SELECT id FROM requests WHERE requester_id = ?)
      OR e.request_id IN (SELECT request_id FROM co_requests WHERE member_id = ?))`);
    bindings.push(actor.id, actor.id, actor.id);
  }

  const events = ctx.sql
    .all<FeedRow>(
      `SELECT members.*, e.id AS event_id, e.type, e.request_id, requests.title AS request_title, requests.poster_path AS request_poster_path,
              e.like_count, e.at, e.data,
              EXISTS (SELECT 1 FROM likes WHERE likes.event_id = e.id AND likes.member_id = ?) AS liked_by_me
       FROM feed_events e JOIN members ON members.id = e.actor_id
       LEFT JOIN requests ON requests.id = e.request_id
       WHERE ${where.join(' AND ')} ORDER BY e.at DESC, e.id DESC LIMIT ?`,
      actor.id,
      ...bindings,
      FEED_PAGE_SIZE,
    )
    .map((row) => ({
      id: row.event_id,
      type: row.type,
      actor: memberView(toMember(row)),
      requestId: row.request_id,
      requestTitle: row.request_title,
      requestPosterPath: row.request_poster_path,
      at: row.at,
      likeCount: row.like_count,
      likedByMe: row.liked_by_me === 1,
      ...(row.type === 'watched' ? { rating: (JSON.parse(row.data) as { rating?: number | null }).rating ?? null } : {}),
    }));
  return events.map((e) => (e.type === 'request_fulfilled' && e.requestId ? { ...e, fulfilledFor: requesterNames(ctx, e.requestId) } : e));
}

/** The requester, then the co-requesters in the order they joined. */
function requesterNames(ctx: Context, requestId: string): string[] {
  return ctx.sql
    .all<{ name: string }>(
      `SELECT members.name FROM requests JOIN members ON members.id = requests.requester_id WHERE requests.id = ?
       UNION ALL
       SELECT * FROM (SELECT members.name FROM co_requests JOIN members ON members.id = co_requests.member_id
                      WHERE co_requests.request_id = ? ORDER BY co_requests.at, members.id)`,
      requestId,
      requestId,
    )
    .map((r) => r.name);
}

/** One like per person per event; liking again undoes it. Likes never subscribe anyone to a request. */
export function toggleLike(ctx: Context, actor: Member, input: { eventId?: unknown }): CommandResult<LikeToggleView> {
  if (typeof input.eventId !== 'string') return failure('invalid');
  const [event] = ctx.sql.all<{ actor_id: string; request_id: string | null }>('SELECT actor_id, request_id FROM feed_events WHERE id = ?', input.eventId);
  if (!event) return failure('not_found');

  const [existing] = ctx.sql.all<{ at: string }>('SELECT at FROM likes WHERE event_id = ? AND member_id = ?', input.eventId, actor.id);
  if (existing) {
    ctx.sql.run('DELETE FROM likes WHERE event_id = ? AND member_id = ?', input.eventId, actor.id);
    ctx.sql.run('UPDATE feed_events SET like_count = like_count - 1 WHERE id = ?', input.eventId);
  } else {
    ctx.sql.run('INSERT INTO likes (event_id, member_id, at) VALUES (?, ?, ?)', input.eventId, actor.id, nowIso(ctx));
    ctx.sql.run('UPDATE feed_events SET like_count = like_count + 1 WHERE id = ?', input.eventId);
  }
  // The author hears about it grouped, at most once per event per hour (docs/spec/notificacoes.md).
  const notified = !existing && event.actor_id !== actor.id;
  if (notified) {
    notify(ctx, { type: 'likes', data: { eventId: input.eventId, requestId: event.request_id, names: [actor.name] }, subjectId: event.actor_id, actorId: actor.id });
  }

  const [{ like_count }] = ctx.sql.all<{ like_count: number }>('SELECT like_count FROM feed_events WHERE id = ?', input.eventId);
  return { ok: true, value: { liked: !existing, likeCount: like_count }, changed: notified ? ['feed', 'notifications'] : ['feed'] };
}

/** Who liked an event, first like first. */
export function listLikes(ctx: Context, input: { eventId?: unknown }): MemberView[] {
  if (typeof input.eventId !== 'string') return [];
  return ctx.sql
    .all<MemberRow>(
      `SELECT members.* FROM likes JOIN members ON members.id = likes.member_id
       WHERE likes.event_id = ? ORDER BY likes.at, members.name`,
      input.eventId,
    )
    .map((row) => memberView(toMember(row)));
}

/** Takes a request's events off the feed, likes included: all of them, or one type by one actor. */
export function removeFeedEvents(ctx: Context, requestId: string, only?: { type: FeedEventType; actorId: string }): void {
  const where = only ? 'request_id = ? AND type = ? AND actor_id = ?' : 'request_id = ?';
  const bindings = only ? [requestId, only.type, only.actorId] : [requestId];
  ctx.sql.run(`DELETE FROM likes WHERE event_id IN (SELECT id FROM feed_events WHERE ${where})`, ...bindings);
  ctx.sql.run(`DELETE FROM feed_events WHERE ${where}`, ...bindings);
}
