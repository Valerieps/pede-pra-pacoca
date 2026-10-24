// Profile and group statistics (docs/spec/estatisticas.md): the filters, the sort and the grouping
// the history accepts, and the calendar arithmetic the queries need. The counting itself runs in
// SQL on the server (ADR-006: little CPU per request).
import type { MediaType } from '../media/media';
import type { RequestOrigin, RequestStatus } from '../request/lifecycle';
import { isDateKey, localParts, localToInstant, monthKey } from '../time';

export type StatsSort = 'newest' | 'oldest' | 'title' | 'person' | 'attendant' | 'type' | 'status' | 'origin' | 'likes';
export type StatsGroupBy = 'none' | 'person' | 'month' | 'type' | 'genre' | 'status' | 'origin' | 'attendant';

export const STATS_SORTS: readonly StatsSort[] = ['newest', 'oldest', 'title', 'person', 'attendant', 'type', 'status', 'origin', 'likes'];
export const STATS_GROUPS: readonly StatsGroupBy[] = ['none', 'person', 'month', 'type', 'genre', 'status', 'origin', 'attendant'];

const STATUSES: readonly RequestStatus[] = ['awaiting_approval', 'approved', 'in_jellyseerr', 'partially_available', 'fulfilled', 'rejected', 'unavailable', 'canceled'];
const ORIGINS: readonly RequestOrigin[] = ['tmdb', 'manual'];

/** The history shows at most this many requests; the counts and metrics still cover all of them. */
export const HISTORY_LIMIT = 200;
export const TOP_GENRES = 5;
export const MOST_LIKED = 5;
export const PROFILE_MONTHS = 12;

export interface StatsFilter {
  readonly memberId?: string;
  /** "YYYY-MM-DD", inclusive, in the group's calendar. */
  readonly from?: string;
  readonly to?: string;
  readonly type?: MediaType;
  readonly genre?: string;
  readonly status?: RequestStatus;
  readonly origin?: RequestOrigin;
  readonly attendantId?: string;
}

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100;

/** Keeps only the filters that make sense; anything else is ignored, not an error. */
export function toStatsFilter(input: unknown): StatsFilter {
  if (typeof input !== 'object' || input === null) return {};
  const raw = input as Record<string, unknown>;
  const filter: { -readonly [K in keyof StatsFilter]: StatsFilter[K] } = {};
  if (isId(raw.memberId)) filter.memberId = raw.memberId;
  if (isDateKey(raw.from)) filter.from = raw.from;
  if (isDateKey(raw.to)) filter.to = raw.to;
  if (raw.type === 'movie' || raw.type === 'tv') filter.type = raw.type;
  if (isId(raw.genre)) filter.genre = raw.genre;
  if (STATUSES.includes(raw.status as RequestStatus)) filter.status = raw.status as RequestStatus;
  if (ORIGINS.includes(raw.origin as RequestOrigin)) filter.origin = raw.origin as RequestOrigin;
  if (isId(raw.attendantId)) filter.attendantId = raw.attendantId;
  return filter;
}

export function toStatsSort(value: unknown): StatsSort {
  return STATS_SORTS.includes(value as StatsSort) ? (value as StatsSort) : 'newest';
}

export function toStatsGroupBy(value: unknown): StatsGroupBy {
  return STATS_GROUPS.includes(value as StatsGroupBy) ? (value as StatsGroupBy) : 'none';
}

function nextDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return localToInstant(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** The period as ISO instants: from 00:00 of `from` up to, not including, 00:00 after `to`. */
export function periodBounds(filter: Pick<StatsFilter, 'from' | 'to'>): { start: string | null; end: string | null } {
  const start = filter.from ? localToInstant(...(filter.from.split('-').map(Number) as [number, number, number])).toISOString() : null;
  const end = filter.to ? nextDay(filter.to).toISOString() : null;
  return { start, end };
}

/** Minutes the group's clock is ahead of UTC at `instant` (−180 in São Paulo). */
export function utcOffsetMinutes(instant: Date): number {
  const p = localParts(instant);
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((local - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * The SQLite date modifier that moves a UTC instant to the group's clock, so SQL can group by month.
 * One offset for every row: São Paulo has had no daylight saving since 2019, before the app existed.
 */
export function sqlLocalModifier(now: Date): string {
  return `${utcOffsetMinutes(now)} minutes`;
}

/** The last `count` months up to the one `now` falls in, oldest first, as "YYYY-MM". */
export function recentMonths(now: Date, count: number): string[] {
  const [year, month] = monthKey(now).split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = year * 12 + (month - 1) - i;
    months.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return months;
}

/** The share of Não foi possível among the requests the attendants closed (Cãopleto or Não foi possível). */
export function unavailableRate(fulfilled: number, unavailable: number): number | null {
  const closed = fulfilled + unavailable;
  return closed === 0 ? null : unavailable / closed;
}
