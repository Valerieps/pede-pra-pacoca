// Números do Grupo (docs/spec/estatisticas.md): the period the screen shows and the time the
// requests spent in Farejando. The counting itself runs in SQL on the server (ADR-006: little CPU
// per request).
import type { RequestStatus } from '../request/lifecycle';

export type StatsPeriod = 'last30' | 'all';

export const STATS_PERIODS: readonly StatsPeriod[] = ['last30', 'all'];
export const PODIUM_SIZE = 3;
export const TRENDING_GENRES = 3;
const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toStatsPeriod(value: unknown): StatsPeriod {
  return STATS_PERIODS.includes(value as StatsPeriod) ? (value as StatsPeriod) : 'last30';
}

/** Where the period starts, as an ISO instant; null for "Desde sempre". */
export function periodStart(period: StatsPeriod, now: Date): string | null {
  return period === 'all' ? null : new Date(now.getTime() - PERIOD_DAYS * DAY_MS).toISOString();
}

export interface Transition {
  readonly requestId: string;
  readonly fromStatus: RequestStatus | null;
  readonly toStatus: RequestStatus;
  readonly at: string;
}

/**
 * Milliseconds the requests spent in Farejando (in_jellyseerr) from `start` up to `now`. A request
 * still in it counts up to now. `transitions` come in the order they happened; rows that are not a
 * status change (same status, or no previous one) neither open nor close a stretch twice.
 */
export function farejandoMs(transitions: readonly Transition[], start: string | null, now: Date): number {
  const from = start ? new Date(start).getTime() : -Infinity;
  const to = now.getTime();
  const openSince = new Map<string, number>();
  let total = 0;
  const close = (requestId: string, at: number) => {
    const since = openSince.get(requestId);
    if (since === undefined) return;
    openSince.delete(requestId);
    total += Math.max(0, Math.min(at, to) - Math.max(since, from));
  };
  for (const t of transitions) {
    const at = new Date(t.at).getTime();
    if (t.toStatus === 'in_jellyseerr') {
      if (!openSince.has(t.requestId)) openSince.set(t.requestId, at);
    } else {
      close(t.requestId, at);
    }
  }
  for (const requestId of [...openSince.keys()]) close(requestId, to);
  return total;
}
