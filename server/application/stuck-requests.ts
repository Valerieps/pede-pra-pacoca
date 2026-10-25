// Mídia travada (docs/spec/notificacoes.md): the daily check that tells the attendants about each
// media stuck in Farejando or Parcialmente disponível, and the snooze they set on the notice.
import { canAttend } from '../../src/domain/group/roles';
import type { NotificationData } from '../../src/domain/notification/types';
import { daysStuck, isStuck, isStuckStatus, stuckCheckDue, validSnoozeDay } from '../../src/domain/request/stuck';
import { localDateKey } from '../../src/domain/time';
import { readConfig, writeConfig } from './config';
import { failure, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { notify } from './notifications';

type Input = Record<string, unknown>;

interface StuckCandidateRow {
  id: string;
  title: string;
  status: string;
  /** When the request last entered its current status. */
  since: string | null;
}

/**
 * Job for `tick()`: once a day, from 09:00, one notice per stuck media (never grouped). A media is
 * told once per stay in a status; a snooze tells again on its day if it is still stuck there.
 * Returns whether anyone was told.
 */
export function warnStuckRequests(ctx: Context): boolean {
  const now = ctx.clock.now();
  if (!stuckCheckDue(now, readConfig(ctx, 'stuckCheckDay', null))) return false;
  const today = localDateKey(now);
  writeConfig(ctx, 'stuckCheckDay', today);

  const candidates = ctx.sql.all<StuckCandidateRow>(
    `SELECT r.id, r.title, r.status,
       (SELECT MAX(t.at) FROM request_transitions t WHERE t.request_id = r.id AND t.to_status = r.status) AS since
     FROM requests r WHERE r.status IN ('in_jellyseerr', 'partially_available')`,
  );
  let warned = false;
  for (const row of candidates) {
    if (!row.since || !isStuckStatus(row.status)) continue;
    const since = new Date(row.since);
    if (!isStuck(row.status, since, now)) continue;
    const [told] = ctx.sql.all<{ snoozed_until: string | null }>(
      'SELECT snoozed_until FROM stuck_notices WHERE request_id = ? AND status = ? AND since = ?',
      row.id,
      row.status,
      row.since,
    );
    if (told && (told.snoozed_until === null || told.snoozed_until > today)) continue;
    ctx.sql.run(
      `INSERT INTO stuck_notices (request_id, status, since, notified_at, snoozed_until) VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT (request_id, status, since) DO UPDATE SET notified_at = excluded.notified_at, snoozed_until = NULL`,
      row.id,
      row.status,
      row.since,
      now.toISOString(),
    );
    notify(ctx, { type: 'request_stuck', data: { requestId: row.id, title: row.title, status: row.status, days: daysStuck(since, now) } });
    warned = true;
  }
  return warned;
}

/** The attendant snoozes a Mídia travada notice to a day ("YYYY-MM-DD"); the notice leaves her inbox. */
export function snoozeStuck(ctx: Context, actor: Member, input: Input): CommandResult<null> {
  if (!canAttend(actor)) return failure('forbidden');
  const [item] = ctx.sql.all<{ data: string }>(
    "SELECT data FROM inbox WHERE id = ? AND member_id = ? AND type = 'request_stuck'",
    typeof input.id === 'string' ? input.id : '',
    actor.id,
  );
  if (!item) return failure('not_found');
  const day = validSnoozeDay(input.until, ctx.clock.now());
  if (!day) return failure('invalid');
  const data = JSON.parse(item.data) as NotificationData['request_stuck'];
  ctx.sql.run(
    `UPDATE stuck_notices SET snoozed_until = ? WHERE rowid =
       (SELECT rowid FROM stuck_notices WHERE request_id = ? AND status = ? ORDER BY since DESC LIMIT 1)`,
    day,
    data.requestId,
    data.status,
  );
  ctx.sql.run(
    "UPDATE inbox SET read = 1 WHERE member_id = ? AND type = 'request_stuck' AND json_extract(data, '$.requestId') = ?",
    actor.id,
    data.requestId,
  );
  return { ok: true, value: null, changed: ['notifications'] };
}
