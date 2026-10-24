// Números do Grupo (docs/spec/estatisticas.md). Read-only: every ranking is counted in SQL, so a
// query stays within the Worker's CPU budget (ADR-006). A tie goes to whoever reached the number
// first: the latest counted moment is the earliest.
import type { GroupNumbersView, MemberView, RankedMemberView, WantedMediaView } from '../../src/application/api-contract';
import { PODIUM_SIZE, TRENDING_GENRES, farejandoMs, periodStart, toStatsPeriod, type Transition } from '../../src/domain/stats/stats';
import type { Context } from './context';
import { memberView, toMember, type MemberRow } from './members';
import type { SqlValue } from './ports';

/** Everyone who wants a media: the requester and the co-requesters, canceled requests left out. */
const WANTS = `WITH wants AS (
  SELECT r.id AS request_id, COALESCE(r.media_key, r.id) AS media, r.requester_id AS member_id, r.created_at AS at
  FROM requests r WHERE r.status != 'canceled'
  UNION ALL
  SELECT r.id, COALESCE(r.media_key, r.id), c.member_id, c.at
  FROM co_requests c JOIN requests r ON r.id = c.request_id WHERE r.status != 'canceled'
)`;

/** `AND <column> >= ?` with its binding when the period has a start, nothing otherwise. */
function since(column: string, start: string | null): { sql: string; bindings: SqlValue[] } {
  return start ? { sql: ` AND ${column} >= ?`, bindings: [start] } : { sql: '', bindings: [] };
}

function ranked(ctx: Context, members: Map<string, MemberView>, sql: string, bindings: SqlValue[]): RankedMemberView[] {
  return ctx.sql.all<{ id: string; count: number }>(`${sql} ORDER BY count DESC, reached LIMIT ?`, ...bindings, PODIUM_SIZE).flatMap(({ id, count }) => {
    const member = members.get(id);
    return member ? [{ member, count }] : [];
  });
}

export function groupNumbers(ctx: Context, input: { period?: unknown }): GroupNumbersView {
  const now = ctx.clock.now();
  const start = periodStart(toStatsPeriod(input.period), now);
  // Removed members stay: they still count in the podiums.
  const members = new Map(ctx.sql.all<MemberRow>('SELECT * FROM members').map((row) => [row.id, memberView(toMember(row))]));

  const requested = since('created_at', start);
  const cashback = since('at', start);
  const thanked = since('thanked_at', start);
  const reserved = since('m.at', start);
  const wanted = since('at', start);

  const topRequesters = ranked(
    ctx,
    members,
    `SELECT requester_id AS id, COUNT(*) AS count, MAX(created_at) AS reached FROM requests WHERE status != 'canceled'${requested.sql} GROUP BY requester_id`,
    requested.bindings,
  );
  const topCashback = ranked(
    ctx,
    members,
    `SELECT member_id AS id, COUNT(*) AS count, MAX(at) AS reached FROM petisco_movements WHERE kind = 'cashback' AND operation = 'credit'${cashback.sql} GROUP BY member_id`,
    cashback.bindings,
  );
  const topThanks = ranked(
    ctx,
    members,
    `SELECT member_id AS id, COUNT(*) AS count, MAX(thanked_at) AS reached FROM feedback WHERE thanked_at IS NOT NULL${thanked.sql} GROUP BY member_id`,
    thanked.bindings,
  );

  const mostWanted = ctx.sql
    .all<{ media: string; count: number }>(
      `${WANTS} SELECT media, COUNT(DISTINCT member_id) AS count FROM wants WHERE 1${wanted.sql} GROUP BY media ORDER BY count DESC, MAX(at) LIMIT ?`,
      ...wanted.bindings,
      PODIUM_SIZE,
    )
    .flatMap(({ media, count }): WantedMediaView[] => {
      const [latest] = ctx.sql.all<{ id: string; title: string; poster_path: string | null }>(
        "SELECT id, title, poster_path FROM requests WHERE COALESCE(media_key, id) = ? AND status != 'canceled' ORDER BY created_at DESC LIMIT 1",
        media,
      );
      return latest ? [{ requestId: latest.id, title: latest.title, posterPath: latest.poster_path, count }] : [];
    });
  const trendingGenres = ctx.sql
    .all<{ genre: string }>(
      `${WANTS} SELECT g.value AS genre FROM wants w JOIN requests r ON r.id = w.request_id, json_each(r.genres) g
       WHERE 1${since('w.at', start).sql} GROUP BY g.value ORDER BY COUNT(*) DESC, MAX(w.at), g.value LIMIT ?`,
      ...wanted.bindings,
      TRENDING_GENRES,
    )
    .map((g) => g.genre);

  const [{ consumed }] = ctx.sql.all<{ consumed: number }>(
    `SELECT COUNT(*) AS consumed FROM petisco_movements m WHERE m.operation = 'reserve'${reserved.sql}
     AND NOT EXISTS (SELECT 1 FROM petisco_movements r WHERE r.operation = 'refund' AND r.request_id = m.request_id AND r.lot = m.lot)`,
    ...reserved.bindings,
  );
  const [{ thanks }] = ctx.sql.all<{ thanks: number }>(`SELECT COUNT(*) AS thanks FROM feedback WHERE thanked_at IS NOT NULL${thanked.sql}`, ...thanked.bindings);
  const transitions = ctx.sql
    .all<{ request_id: string; from_status: Transition['fromStatus']; to_status: Transition['toStatus']; at: string }>(
      `SELECT request_id, from_status, to_status, at FROM request_transitions
       WHERE to_status = 'in_jellyseerr' OR from_status = 'in_jellyseerr' ORDER BY request_id, id`,
    )
    .map((t) => ({ requestId: t.request_id, fromStatus: t.from_status, toStatus: t.to_status, at: t.at }));

  return {
    topRequesters,
    topCashback,
    topThanks,
    mostWanted,
    trendingGenres,
    petiscosConsumed: consumed,
    thanksReceived: thanks,
    farejandoMs: farejandoMs(transitions, start, now),
  };
}
