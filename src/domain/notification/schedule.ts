// When a push goes out (docs/spec/notificacoes.md). Quiet hours hold the push only; the inbox gets
// everything at once. All clock times are local to the group's time zone.
import { addDays, localParts, localToInstant } from '../time';
import { clockMinutes, type QuietHours } from './preferences';

const HOUR_MS = 60 * 60 * 1000;

/** At most one push per feed event per hour. */
export const LIKE_WINDOW_MS = HOUR_MS;

function localMinutes(instant: Date): number {
  const { hour, minute } = localParts(instant);
  return hour * 60 + minute;
}

/** The next instant, strictly after `after`, when the local clock reads `time`. */
export function nextLocalTime(after: Date, time: string): Date {
  const { year, month, day } = localParts(after);
  const minutes = clockMinutes(time);
  const today = localToInstant(year, month, day, Math.floor(minutes / 60), minutes % 60);
  if (today > after) return today;
  const next = localParts(addDays(today, 1));
  return localToInstant(next.year, next.month, next.day, Math.floor(minutes / 60), minutes % 60);
}

/** Whether `instant` falls in the quiet hours. Start equal to end means no quiet hours. */
export function inQuietHours(instant: Date, quiet: QuietHours | null): boolean {
  if (!quiet) return false;
  const start = clockMinutes(quiet.start);
  const end = clockMinutes(quiet.end);
  const now = localMinutes(instant);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** The earliest instant from `wanted` on when a push may go out: the end of quiet hours, if in them. */
export function pushTime(wanted: Date, quiet: QuietHours | null): Date {
  return quiet && inQuietHours(wanted, quiet) ? nextLocalTime(wanted, quiet.end) : wanted;
}

/** When the daily digest that collects a new request made at `now` goes out. */
export function digestTime(now: Date, time: string, quiet: QuietHours | null): Date {
  return pushTime(nextLocalTime(now, time), quiet);
}

/**
 * When a like's push goes out: at once if the event's last push is over an hour old, otherwise
 * when that hour closes, together with every like that arrives until then.
 */
export function likePushTime(now: Date, lastSentAt: Date | null, quiet: QuietHours | null): Date {
  const wanted = lastSentAt && now.getTime() - lastSentAt.getTime() < LIKE_WINDOW_MS ? new Date(lastSentAt.getTime() + LIKE_WINDOW_MS) : now;
  return pushTime(wanted, quiet);
}
