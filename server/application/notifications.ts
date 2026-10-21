// Notifications (docs/spec/notificacoes.md): every notice goes to the inbox at once and to the
// outbox for the push, which waits for quiet hours, the daily digest or the hour of grouped likes.
// The Durable Object sends what is due after each command and on the cron (ADR-011).
//
// For the other features: call `notify` inside your command, after the rule passed, and add
// 'notifications' to the command's `changed` topics. It writes in the command's transaction.
import { PUSH_SERVICE_ORIGINS } from '../../network-policy';
import type { InboxItemView, InboxView, NotificationSettingsView, PushSubscriptionInput } from '../../src/application/api-contract';
import { canAttend, isAttendant, normalizeRoles } from '../../src/domain/group/roles';
import { recipients, type Attendant } from '../../src/domain/notification/audience';
import { applyPrefs, parsePrefs, type NotificationPrefs } from '../../src/domain/notification/preferences';
import { mergeData, renderNotification } from '../../src/domain/notification/render';
import { digestTime, inQuietHours, likePushTime, pushTime } from '../../src/domain/notification/schedule';
import { switchOf, type NotificationData, type NotificationType } from '../../src/domain/notification/types';
import { failure, nowIso, type CommandResult, type Context } from './context';
import type { Member } from './members';

/** The inbox keeps each member's latest notices. */
export const INBOX_LIMIT = 100;
/** Old devices are dropped beyond this many per member. */
export const SUBSCRIPTIONS_PER_MEMBER = 10;
/** Sent rows stay this long, enough to group likes by the hour. */
const SENT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_BODY = 300;

export type TriggerType = Exclude<NotificationType, 'daily_digest'>;

/** One trigger. The people fields say who is around it; the audience rule picks among them. */
export interface Notice<T extends TriggerType = TriggerType> {
  readonly type: T;
  readonly data: NotificationData[T];
  /** Whoever caused it; never notified of their own action. */
  readonly actorId?: string | null;
  readonly requesterId?: string | null;
  readonly coRequesterIds?: readonly string[];
  /** The one person a notice is about: event author, petisco owner, thanked attendant, heir. */
  readonly subjectId?: string | null;
}

/** A push ready to be encrypted and sent: the Durable Object does the network part. */
export interface PushJob {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly payload: string;
}

export interface DuePushes {
  readonly jobs: readonly PushJob[];
  /** A digest went out, so it reached the inbox now: open apps refetch. */
  readonly inboxChanged: boolean;
}

interface MemberPrefsRow {
  id: string;
  roles: string;
  active: number;
  vacation: number;
  notification_prefs: string;
}

interface OutboxRow {
  id: string;
  member_id: string;
  type: NotificationType;
  data: string;
  group_key: string | null;
}

function prefsOf(ctx: Context, memberId: string): NotificationPrefs {
  const [row] = ctx.sql.all<{ notification_prefs: string }>('SELECT notification_prefs FROM members WHERE id = ?', memberId);
  return parsePrefs(row?.notification_prefs);
}

function insertInbox(ctx: Context, memberId: string, type: NotificationType, data: unknown): void {
  ctx.sql.run('INSERT INTO inbox (id, member_id, type, data, read, at) VALUES (?, ?, ?, ?, 0, ?)', ctx.ids.next(), memberId, type, JSON.stringify(data), nowIso(ctx));
  ctx.sql.run(
    `DELETE FROM inbox WHERE member_id = ? AND rowid NOT IN
       (SELECT rowid FROM inbox WHERE member_id = ? ORDER BY at DESC, rowid DESC LIMIT ?)`,
    memberId,
    memberId,
    INBOX_LIMIT,
  );
}

function enqueue(ctx: Context, memberId: string, type: NotificationType, data: unknown, groupKey: string | null, deliverAfter: Date): void {
  if (groupKey) {
    const [pending] = ctx.sql.all<OutboxRow>('SELECT * FROM outbox WHERE member_id = ? AND group_key = ? AND sent_at IS NULL', memberId, groupKey);
    if (pending) {
      const merged = mergeData(type, JSON.parse(pending.data) as never, data as never);
      ctx.sql.run('UPDATE outbox SET data = ? WHERE id = ?', JSON.stringify(merged), pending.id);
      return;
    }
  }
  ctx.sql.run(
    'INSERT INTO outbox (id, member_id, type, data, group_key, deliver_after) VALUES (?, ?, ?, ?, ?, ?)',
    ctx.ids.next(),
    memberId,
    type,
    JSON.stringify(data),
    groupKey,
    deliverAfter.toISOString(),
  );
}

/** Likes keep one inbox item per event, refreshed with every new name. */
function upsertLikesInbox(ctx: Context, memberId: string, data: NotificationData['likes']): void {
  const [item] = ctx.sql.all<{ id: string; data: string }>(
    "SELECT id, data FROM inbox WHERE member_id = ? AND type = 'likes' AND json_extract(data, '$.eventId') = ?",
    memberId,
    data.eventId,
  );
  if (!item) return insertInbox(ctx, memberId, 'likes', data);
  const merged = mergeData('likes', JSON.parse(item.data) as NotificationData['likes'], data);
  ctx.sql.run('UPDATE inbox SET data = ?, read = 0, at = ? WHERE id = ?', JSON.stringify(merged), nowIso(ctx), item.id);
}

/** Records a notice for everyone it concerns, in the calling command's transaction. */
export function notify<T extends TriggerType>(ctx: Context, notice: Notice<T>): void {
  const members = ctx.sql.all<MemberPrefsRow>('SELECT id, roles, active, vacation, notification_prefs FROM members WHERE active = 1');
  const attendants: Attendant[] = members
    .filter((m) => isAttendant({ roles: normalizeRoles(JSON.parse(m.roles) as string[]) }))
    .map((m) => ({ id: m.id, onVacation: m.vacation === 1 }));
  const ids = recipients(notice.type, {
    attendants,
    activeMemberIds: members.map((m) => m.id),
    requesterId: notice.requesterId,
    coRequesterIds: notice.coRequesterIds,
    subjectId: notice.subjectId,
    actorId: notice.actorId,
  });
  const now = ctx.clock.now();

  for (const memberId of ids) {
    const prefs = parsePrefs(members.find((m) => m.id === memberId)?.notification_prefs);
    if (!prefs.enabled[switchOf(notice.type)]) continue;

    if (notice.type === 'request_new' && prefs.newRequests === 'digest') {
      // The digest reaches the inbox when it goes out, as one notice.
      const { title } = notice.data as NotificationData['request_new'];
      enqueue(ctx, memberId, 'daily_digest', { titles: [title] }, 'digest', digestTime(now, prefs.digestTime, prefs.quietHours));
    } else if (notice.type === 'likes') {
      const data = notice.data as NotificationData['likes'];
      upsertLikesInbox(ctx, memberId, data);
      const groupKey = `likes:${data.eventId}`;
      const [last] = ctx.sql.all<{ sent: string | null }>('SELECT MAX(sent_at) AS sent FROM outbox WHERE member_id = ? AND group_key = ?', memberId, groupKey);
      enqueue(ctx, memberId, 'likes', data, groupKey, likePushTime(now, last?.sent ? new Date(last.sent) : null, prefs.quietHours));
    } else {
      insertInbox(ctx, memberId, notice.type, notice.data);
      enqueue(ctx, memberId, notice.type, notice.data, null, pushTime(now, prefs.quietHours));
    }
  }
}

/**
 * Marks the due pushes as sent and returns them for the Durable Object to deliver, at most
 * `maxPushes` (Workers Free: small batches, ADR-006). At most once: a push that fails to send is
 * not retried, and the inbox still has the notice.
 */
export function claimDuePushes(ctx: Context, maxPushes: number): DuePushes {
  const now = ctx.clock.now();
  const at = now.toISOString();
  const jobs: PushJob[] = [];
  let inboxChanged = false;
  const due = ctx.sql.all<OutboxRow>(
    'SELECT id, member_id, type, data, group_key FROM outbox WHERE sent_at IS NULL AND deliver_after <= ? ORDER BY deliver_after LIMIT ?',
    at,
    maxPushes * 2,
  );

  for (const row of due) {
    if (jobs.length >= maxPushes) break;
    const [member] = ctx.sql.all<MemberPrefsRow>('SELECT id, roles, active, vacation, notification_prefs FROM members WHERE id = ?', row.member_id);
    const markSent = () => ctx.sql.run('UPDATE outbox SET sent_at = ? WHERE id = ?', at, row.id);
    const prefs = parsePrefs(member?.notification_prefs);
    const isDigest = row.type === 'daily_digest';
    const attendant = member ? isAttendant({ roles: normalizeRoles(JSON.parse(member.roles) as string[]) }) : false;

    // Things may have changed since it was queued: removed, switched off, on vacation.
    if (!member || member.active !== 1 || !prefs.enabled[switchOf(row.type)] || (isDigest && (member.vacation === 1 || !attendant))) {
      markSent();
      continue;
    }
    if (inQuietHours(now, prefs.quietHours)) {
      ctx.sql.run('UPDATE outbox SET deliver_after = ? WHERE id = ?', pushTime(now, prefs.quietHours).toISOString(), row.id);
      continue;
    }

    markSent();
    const data = JSON.parse(row.data) as NotificationData[NotificationType];
    if (isDigest) {
      insertInbox(ctx, row.member_id, row.type, data);
      inboxChanged = true;
    }
    const rendered = renderNotification(row.type, data as never);
    const payload = JSON.stringify({
      title: rendered.title,
      body: rendered.body.length > MAX_BODY ? `${rendered.body.slice(0, MAX_BODY - 1)}…` : rendered.body,
      url: rendered.url,
      tag: row.group_key ?? row.id,
    });
    const subscriptions = ctx.sql.all<{ endpoint: string; p256dh: string; auth: string }>(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ?',
      row.member_id,
    );
    for (const s of subscriptions) jobs.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, payload });
  }
  return { jobs, inboxChanged };
}

/** Push services answer 404 or 410 for subscriptions that are gone: forget them. */
export function removePushSubscriptions(ctx: Context, endpoints: readonly string[]): void {
  for (const endpoint of endpoints) ctx.sql.run('DELETE FROM push_subscriptions WHERE endpoint = ?', endpoint);
}

export function pruneOutbox(ctx: Context): void {
  const before = new Date(ctx.clock.now().getTime() - SENT_RETENTION_MS).toISOString();
  ctx.sql.run('DELETE FROM outbox WHERE sent_at IS NOT NULL AND sent_at < ?', before);
}

// --- Queries and commands ---

export function inbox(ctx: Context, actor: Member): InboxView {
  const rows = ctx.sql.all<{ id: string; type: NotificationType; data: string; read: number; at: string }>(
    'SELECT id, type, data, read, at FROM inbox WHERE member_id = ? ORDER BY at DESC, rowid DESC',
    actor.id,
  );
  const items: InboxItemView[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    ...renderNotification(row.type, JSON.parse(row.data) as never),
    read: row.read === 1,
    at: row.at,
  }));
  return { items, unread: items.filter((i) => !i.read).length };
}

export function markRead(ctx: Context, actor: Member, input: { ids?: unknown }): CommandResult<null> {
  if (input.ids === undefined) {
    ctx.sql.run('UPDATE inbox SET read = 1 WHERE member_id = ?', actor.id);
  } else {
    if (!Array.isArray(input.ids) || input.ids.length > INBOX_LIMIT || !input.ids.every((id) => typeof id === 'string')) return failure('invalid');
    for (const id of input.ids as string[]) ctx.sql.run('UPDATE inbox SET read = 1 WHERE id = ? AND member_id = ?', id, actor.id);
  }
  return { ok: true, value: null, changed: ['notifications'] };
}

export function notificationSettings(ctx: Context, actor: Member, pushPublicKey: string | null): NotificationSettingsView {
  return { prefs: prefsOf(ctx, actor.id), pushPublicKey, attendant: canAttend(actor) };
}

export function setPrefs(ctx: Context, actor: Member, input: Record<string, unknown>): CommandResult<NotificationPrefs> {
  const next = applyPrefs(prefsOf(ctx, actor.id), input);
  if (!next) return failure('invalid');
  ctx.sql.run('UPDATE members SET notification_prefs = ? WHERE id = ?', JSON.stringify(next), actor.id);
  return { ok: true, value: next, changed: ['notifications'] };
}

function decodedLength(value: unknown): number {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return -1;
  try {
    return atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')).length;
  } catch {
    return -1;
  }
}

/** Only https endpoints of the known push services (network-policy.ts, ADR-011). */
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && PUSH_SERVICE_ORIGINS.includes(url.origin);
}

export function subscribePush(ctx: Context, actor: Member, input: Partial<Record<keyof PushSubscriptionInput, unknown>>): CommandResult<null> {
  const { endpoint, p256dh, auth } = input;
  // P-256 public key, uncompressed (65 bytes), and a 16-byte auth secret (RFC 8291).
  if (!isAllowedPushEndpoint(endpoint) || decodedLength(p256dh) !== 65 || decodedLength(auth) !== 16) return failure('invalid');
  ctx.sql.run(
    `INSERT INTO push_subscriptions (endpoint, member_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
    endpoint,
    actor.id,
    p256dh as string,
    auth as string,
    nowIso(ctx),
  );
  ctx.sql.run(
    `DELETE FROM push_subscriptions WHERE member_id = ? AND endpoint NOT IN
       (SELECT endpoint FROM push_subscriptions WHERE member_id = ? ORDER BY created_at DESC LIMIT ?)`,
    actor.id,
    actor.id,
    SUBSCRIPTIONS_PER_MEMBER,
  );
  return { ok: true, value: null, changed: [] };
}

export function unsubscribePush(ctx: Context, actor: Member, input: { endpoint?: unknown }): CommandResult<null> {
  if (typeof input.endpoint !== 'string') return failure('invalid');
  ctx.sql.run('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?', input.endpoint, actor.id);
  return { ok: true, value: null, changed: [] };
}
