// The group's public timeline and its likes (docs/spec/feed.md).
import type { FeedEventType, FeedEventView, LikeToggleView, MemberView } from '../../src/application/api-contract';
import { FEED_PAGE_SIZE, FOUND_MIN_GAP, toFeedFilter } from '../../src/domain/feed/feed';
import { isActive, type RequestStatus } from '../../src/domain/request/lifecycle';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { memberView, toMember, type Member, type MemberRow } from './members';
import { notify } from './notifications';

// Recorded, but not shown: "Fulano também quer" and "Fulano agradeceu" are noise in the timeline.
const HIDDEN_EVENTS: readonly FeedEventType[] = ['co_request', 'thanked'];

// "A Paçoca achou" shows only when at least FOUND_MIN_GAP posts sit between it and its "pediu":
// closer than that, the status on "pediu" already says it. Other "achou" posts do not count.
const FOUND_SHOWN = `(e.type <> 'request_fulfilled' OR (
  SELECT COUNT(*) FROM feed_events c JOIN feed_events m
    ON (m.at > c.at OR (m.at = c.at AND m.id > c.id)) AND (m.at < e.at OR (m.at = e.at AND m.id < e.id))
  WHERE c.request_id = e.request_id AND c.type = 'request_created'
    AND m.type NOT IN (${[...HIDDEN_EVENTS, 'request_fulfilled'].map((type) => `'${type}'`).join(', ')})
) >= ${FOUND_MIN_GAP})`;

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
  request_status: RequestStatus | null;
  requester_id: string | null;
  joined_by_me: number;
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

  const where = [beforeId === null ? 'e.at < ?' : '(e.at < ? OR (e.at = ? AND e.id < ?))', `e.type NOT IN (${HIDDEN_EVENTS.map(() => '?').join(', ')})`, FOUND_SHOWN];
  const bindings: (string | number)[] = beforeId === null ? [before, ...HIDDEN_EVENTS] : [before, before, beforeId, ...HIDDEN_EVENTS];
  if (filter === 'requests') {
    where.push("e.type = 'request_created'");
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
              requests.status AS request_status, requests.requester_id,
              EXISTS (SELECT 1 FROM co_requests c WHERE c.request_id = e.request_id AND c.member_id = ?) AS joined_by_me,
              e.like_count, e.at, e.data,
              EXISTS (SELECT 1 FROM likes WHERE likes.event_id = e.id AND likes.member_id = ?) AS liked_by_me
       FROM feed_events e JOIN members ON members.id = e.actor_id
       LEFT JOIN requests ON requests.id = e.request_id
       WHERE ${where.join(' AND ')} ORDER BY e.at DESC, e.id DESC LIMIT ?`,
      actor.id,
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
      requestStatus: row.request_status,
      at: row.at,
      likeCount: row.like_count,
      likedByMe: row.liked_by_me === 1,
      ...(row.type === 'request_created' && row.request_status && row.requester_id !== actor.id && row.joined_by_me === 0 && isActive(row.request_status)
        ? { canJoin: true }
        : {}),
    }));
  return events;
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
