// Mídia travada (docs/spec/notificacoes.md): a request that sits too long in Farejando or
// Parcialmente disponível tells the attendants, once, at the daily check. The attendant can snooze
// the notice to a day; that day's check tells again if the media is still stuck.
import { addDays, isDateKey, localDateKey, localParts } from '../time';
import type { RequestStatus } from './lifecycle';

export type StuckStatus = Extract<RequestStatus, 'in_jellyseerr' | 'partially_available'>;

/** Days in the status after which the media counts as stuck. */
export const STUCK_DAYS: Readonly<Record<StuckStatus, number>> = { in_jellyseerr: 3, partially_available: 5 };

/** The daily check runs once, at the first cron from this local hour on. */
export const STUCK_CHECK_HOUR = 9;

/** The snooze buttons, in days; the attendant can also pick a day. */
export const SNOOZE_DAYS = [3, 7, 14] as const;
export const MAX_SNOOZE_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isStuckStatus(status: string): status is StuckStatus {
  return status === 'in_jellyseerr' || status === 'partially_available';
}

/** "Mais de 3 dias": strictly longer than the limit. */
export function isStuck(status: StuckStatus, since: Date, now: Date): boolean {
  return now.getTime() - since.getTime() > STUCK_DAYS[status] * DAY_MS;
}

/** Whole days in the status, for the notice's text. */
export function daysStuck(since: Date, now: Date): number {
  return Math.floor((now.getTime() - since.getTime()) / DAY_MS);
}

/** Whether today's check is still to run: from 09:00 local, once per local day. */
export function stuckCheckDue(now: Date, lastRunDay: string | null): boolean {
  return localParts(now).hour >= STUCK_CHECK_HOUR && localDateKey(now) !== lastRunDay;
}

/** A snooze is a local day after today and at most a year ahead; null when `day` is not one. */
export function validSnoozeDay(day: unknown, now: Date): string | null {
  if (!isDateKey(day)) return null;
  const today = localDateKey(now);
  return day > today && day <= localDateKey(addDays(now, MAX_SNOOZE_DAYS)) ? day : null;
}
