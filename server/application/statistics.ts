// Profile and group statistics (docs/spec/estatisticas.md). Read-only: every number is counted in
// SQL, on indexed columns, so a query stays within the Worker's CPU budget (ADR-006).
import type {
  GroupStatsView,
  HistoryGroupView,
  HistoryRequestView,
  MemberView,
  ProfileStatsView,
} from '../../src/application/api-contract';
import type { MediaType } from '../../src/domain/media/media';
import type { RequestOrigin, RequestStatus } from '../../src/domain/request/lifecycle';
import {
  HISTORY_LIMIT,
  MOST_LIKED,
  PROFILE_MONTHS,
  TOP_GENRES,
  periodBounds,
  recentMonths,
  sqlLocalModifier,
  toStatsFilter,
  toStatsGroupBy,
  toStatsSort,
  unavailableRate,
  type StatsFilter,
  type StatsGroupBy,
  type StatsSort,
} from '../../src/domain/stats/stats';
import { QueryError, type Context } from './context';
import { memberView, toMember, type MemberRow } from './members';
import type { SqlValue } from './ports';

/** When a request first became Cãopleto; `r` is the request. */
const FULFILLED_AT = `(SELECT MIN(t.at) FROM request_transitions t WHERE t.request_id = r.id AND t.to_status = 'fulfilled')`;
const MS_TO_FULFILLED = `(julianday(${FULFILLED_AT}) - julianday(r.created_at)) * 86400000`;

function membersById(ctx: Context): Map<string, MemberView> {
  return new Map(ctx.sql.all<MemberRow>('SELECT * FROM members').map((row) => [row.id, memberView(toMember(row))]));
}

function roundMs(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

export function memberProfile(ctx: Context, input: { memberId?: unknown }): ProfileStatsView | QueryError {
  if (typeof input.memberId !== 'string') return new QueryError('invalid');
  const [row] = ctx.sql.all<MemberRow>('SELECT * FROM members WHERE id = ?', input.memberId);
  if (!row) return new QueryError('not_found');
  const id = row.id;
  const now = ctx.clock.now();

  const [totals] = ctx.sql.all<{ total: number; fulfilled: number | null; avg_ms: number | null }>(
    `SELECT COUNT(*) AS total, SUM(r.status = 'fulfilled') AS fulfilled,
            AVG(CASE WHEN r.status = 'fulfilled' THEN ${MS_TO_FULFILLED} END) AS avg_ms
     FROM requests r WHERE r.requester_id = ? AND r.status != 'canceled'`,
    id,
  );
  const topGenres = ctx.sql.all<{ genre: string; count: number }>(
    `SELECT g.value AS genre, COUNT(*) AS count FROM requests r, json_each(r.genres) g
     WHERE r.requester_id = ? AND r.status != 'canceled'
     GROUP BY g.value ORDER BY count DESC, genre LIMIT ?`,
    id,
    TOP_GENRES,
  );
  const months = recentMonths(now, PROFILE_MONTHS);
  const counted = new Map(
    ctx.sql
      .all<{ month: string; count: number }>(
        `SELECT strftime('%Y-%m', r.created_at, ?) AS month, COUNT(*) AS count FROM requests r
         WHERE r.requester_id = ? AND r.status != 'canceled' AND r.created_at >= ?
         GROUP BY month`,
        sqlLocalModifier(now),
        id,
        periodBounds({ from: `${months[0]}-01` }).start,
      )
      .map((m) => [m.month, m.count]),
  );
  const [{ cashbacks }] = ctx.sql.all<{ cashbacks: number }>(
    `SELECT COUNT(*) AS cashbacks FROM petisco_movements WHERE member_id = ? AND kind = 'cashback' AND operation = 'credit'`,
    id,
  );
  const [{ likes }] = ctx.sql.all<{ likes: number }>(
    `SELECT COUNT(*) AS likes FROM feed_events e JOIN likes l ON l.event_id = e.id
     WHERE e.actor_id = ? AND l.member_id != ?`,
    id,
    id,
  );

  return {
    member: memberView(toMember(row)),
    totalRequests: totals.total,
    fulfilled: totals.fulfilled ?? 0,
    averageMsToFulfilled: roundMs(totals.avg_ms),
    topGenres,
    perMonth: months.map((month) => ({ month, count: counted.get(month) ?? 0 })),
    cashbacks,
    likesReceived: likes,
  };
}

/** The filtered requests as a CTE named `f`, with its bindings. Canceled ones only when asked for. */
function filtered(filter: StatsFilter): { cte: string; bindings: SqlValue[] } {
  const where: string[] = [];
  const bindings: SqlValue[] = [];
  const { start, end } = periodBounds(filter);
  if (filter.status) {
    where.push('r.status = ?');
    bindings.push(filter.status);
  } else {
    where.push("r.status != 'canceled'");
  }
  if (filter.memberId) {
    where.push('r.requester_id = ?');
    bindings.push(filter.memberId);
  }
  if (start) {
    where.push('r.created_at >= ?');
    bindings.push(start);
  }
  if (end) {
    where.push('r.created_at < ?');
    bindings.push(end);
  }
  if (filter.type) {
    where.push('r.media_type = ?');
    bindings.push(filter.type);
  }
  if (filter.genre) {
    where.push('EXISTS (SELECT 1 FROM json_each(r.genres) g WHERE g.value = ?)');
    bindings.push(filter.genre);
  }
  if (filter.origin) {
    where.push('r.origin = ?');
    bindings.push(filter.origin);
  }
  if (filter.attendantId) {
    where.push('r.assignee_id = ?');
    bindings.push(filter.attendantId);
  }
  return { cte: `WITH f AS (SELECT r.* FROM requests r WHERE ${where.join(' AND ')})`, bindings };
}

const ORDER_BY: Record<StatsSort, string> = {
  newest: 'f.created_at DESC',
  oldest: 'f.created_at ASC',
  title: 'f.title COLLATE NOCASE',
  person: 'requester.name COLLATE NOCASE',
  attendant: 'assignee.name IS NULL, assignee.name COLLATE NOCASE',
  type: 'f.media_type',
  status: 'f.status',
  origin: 'f.origin',
  likes: 'likes DESC',
};

/** The SQL that gives a request's group key, for every grouping but genre (a request has several). */
function groupKeySql(groupBy: Exclude<StatsGroupBy, 'genre' | 'none'>): string {
  switch (groupBy) {
    case 'person':
      return 'f.requester_id';
    case 'attendant':
      return "COALESCE(f.assignee_id, '')";
    case 'month':
      return "strftime('%Y-%m', f.created_at, ?)";
    case 'type':
      return 'f.media_type';
    case 'status':
      return 'f.status';
    case 'origin':
      return 'f.origin';
  }
}

interface HistoryRow {
  id: string;
  title: string;
  media_type: MediaType;
  origin: RequestOrigin;
  status: RequestStatus;
  genres: string;
  poster_path: string | null;
  requester_id: string;
  assignee_id: string | null;
  created_at: string;
  month: string;
  likes: number;
}

export function groupStats(ctx: Context, input: { filter?: unknown; sort?: unknown; groupBy?: unknown }): GroupStatsView {
  const filter = toStatsFilter(input.filter);
  const sort = toStatsSort(input.sort);
  const groupBy = toStatsGroupBy(input.groupBy);
  const local = sqlLocalModifier(ctx.clock.now());
  const { cte, bindings } = filtered(filter);
  const members = membersById(ctx);
  const member = (id: string | null) => (id ? (members.get(id) ?? null) : null);

  const [totals] = ctx.sql.all<{ total: number; fulfilled: number | null; unavailable: number | null; avg_ms: number | null }>(
    `${cte} SELECT COUNT(*) AS total, SUM(r.status = 'fulfilled') AS fulfilled, SUM(r.status = 'unavailable') AS unavailable,
            AVG(CASE WHEN r.status = 'fulfilled' THEN ${MS_TO_FULFILLED} END) AS avg_ms
     FROM f r`,
    ...bindings,
  );
  const countBy = (column: string) =>
    ctx.sql
      .all<{ id: string; count: number }>(`${cte} SELECT ${column} AS id, COUNT(*) AS count FROM f WHERE ${column} IS NOT NULL GROUP BY ${column} ORDER BY count DESC`, ...bindings)
      .flatMap(({ id, count }) => {
        const view = member(id);
        return view ? [{ member: view, count }] : [];
      });
  const [petiscos] = ctx.sql.all<{ consumed: number | null; returned: number | null }>(
    `${cte} SELECT SUM(operation = 'debit') AS consumed, SUM(kind = 'cashback' AND operation = 'credit') AS returned
     FROM petisco_movements WHERE request_id IN (SELECT id FROM f)`,
    ...bindings,
  );
  const perGenre = ctx.sql.all<{ genre: string; count: number }>(
    `${cte} SELECT COALESCE(g.value, '') AS genre, COUNT(*) AS count FROM f LEFT JOIN json_each(f.genres) g
     GROUP BY genre ORDER BY count DESC, genre`,
    ...bindings,
  );
  const mostLiked = ctx.sql.all<{ requestId: string; title: string; likes: number }>(
    `${cte} SELECT f.id AS requestId, f.title, SUM(e.like_count) AS likes
     FROM f JOIN feed_events e ON e.request_id = f.id
     GROUP BY f.id HAVING likes > 0 ORDER BY likes DESC, f.created_at DESC LIMIT ?`,
    ...bindings,
    MOST_LIKED,
  );

  const rows = ctx.sql.all<HistoryRow>(
    `${cte} SELECT f.id, f.title, f.media_type, f.origin, f.status, f.genres, f.poster_path, f.requester_id, f.assignee_id,
            f.created_at, strftime('%Y-%m', f.created_at, ?) AS month,
            (SELECT COALESCE(SUM(e.like_count), 0) FROM feed_events e WHERE e.request_id = f.id) AS likes
     FROM f JOIN members requester ON requester.id = f.requester_id
     LEFT JOIN members assignee ON assignee.id = f.assignee_id
     ORDER BY ${ORDER_BY[sort]}, f.created_at DESC, f.id LIMIT ?`,
    ...bindings,
    local,
    HISTORY_LIMIT + 1,
  );
  const truncated = rows.length > HISTORY_LIMIT;
  const shown = rows.slice(0, HISTORY_LIMIT);

  return {
    total: totals.total,
    truncated,
    groups: buildGroups(ctx, groupBy, totals.total, cte, bindings, local, shown, member),
    metrics: {
      fulfilled: totals.fulfilled ?? 0,
      perGenre,
      perPerson: countBy('requester_id'),
      perAttendant: countBy('assignee_id'),
      averageMsToFulfilled: roundMs(totals.avg_ms),
      unavailableRate: unavailableRate(totals.fulfilled ?? 0, totals.unavailable ?? 0),
      petiscosConsumed: petiscos.consumed ?? 0,
      petiscosReturned: petiscos.returned ?? 0,
      mostLiked,
    },
    options: filterOptions(ctx, members),
  };
}

function buildGroups(
  ctx: Context,
  groupBy: StatsGroupBy,
  total: number,
  cte: string,
  bindings: SqlValue[],
  local: string,
  rows: HistoryRow[],
  member: (id: string | null) => MemberView | null,
): HistoryGroupView[] {
  const views = rows.map((row) => ({ row, view: toHistoryView(row, member) }));
  if (groupBy === 'none') return [{ key: '', member: null, count: total, requests: views.map((v) => v.view) }];

  // Counts over every filtered request; the shown rows are only the first HISTORY_LIMIT.
  const counts =
    groupBy === 'genre'
      ? ctx.sql.all<{ group_key: string; count: number }>(
          `${cte} SELECT COALESCE(g.value, '') AS group_key, COUNT(*) AS count FROM f LEFT JOIN json_each(f.genres) g
           GROUP BY group_key ORDER BY count DESC, group_key`,
          ...bindings,
        )
      : ctx.sql.all<{ group_key: string; count: number }>(
          `${cte} SELECT ${groupKeySql(groupBy)} AS group_key, COUNT(*) AS count FROM f GROUP BY group_key
           ORDER BY ${groupBy === 'month' ? 'group_key DESC' : 'count DESC, group_key'}`,
          ...bindings,
          ...(groupBy === 'month' ? [local] : []),
        );

  const keysOf = (row: HistoryRow): string[] => {
    switch (groupBy) {
      case 'genre': {
        const genres = JSON.parse(row.genres) as string[];
        return genres.length > 0 ? genres : [''];
      }
      case 'person':
        return [row.requester_id];
      case 'attendant':
        return [row.assignee_id ?? ''];
      case 'month':
        return [row.month];
      case 'type':
        return [row.media_type];
      case 'status':
        return [row.status];
      case 'origin':
        return [row.origin];
    }
  };
  const byKey = new Map<string, HistoryRequestView[]>();
  for (const { row, view } of views) {
    for (const key of keysOf(row)) byKey.set(key, [...(byKey.get(key) ?? []), view]);
  }
  const withMember = groupBy === 'person' || groupBy === 'attendant';
  return counts.map(({ group_key: key, count }) => ({ key, member: withMember ? member(key) : null, count, requests: byKey.get(key) ?? [] }));
}

function toHistoryView(row: HistoryRow, member: (id: string | null) => MemberView | null): HistoryRequestView {
  return {
    id: row.id,
    title: row.title,
    mediaType: row.media_type,
    origin: row.origin,
    status: row.status,
    genres: JSON.parse(row.genres) as string[],
    posterPath: row.poster_path,
    requester: member(row.requester_id)!,
    assignee: member(row.assignee_id),
    createdAt: row.created_at,
    likes: row.likes,
  };
}

function filterOptions(ctx: Context, members: Map<string, MemberView>): GroupStatsView['options'] {
  const genres = ctx.sql.all<{ genre: string }>('SELECT DISTINCT g.value AS genre FROM requests r, json_each(r.genres) g ORDER BY genre').map((g) => g.genre);
  const assigned = new Set(ctx.sql.all<{ id: string }>('SELECT DISTINCT assignee_id AS id FROM requests WHERE assignee_id IS NOT NULL').map((a) => a.id));
  const attendants = [...members.values()]
    .filter((m) => assigned.has(m.id) || m.roles.includes('attendant'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { genres, attendants };
}
