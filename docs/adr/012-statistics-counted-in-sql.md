# ADR-012: Statistics counted in SQL, months on a fixed São Paulo offset

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** The profile and group statistics (`server/application/statistics.ts`, queries
`stats.profile` and `stats.group`) count, average and group in SQLite, not in JavaScript. The time
to Atendido is the first `request_transitions` row with `to_status = 'fulfilled'` minus the request's
`created_at`. Months are grouped with `strftime('%Y-%m', at, '<offset> minutes')`, where the offset
is São Paulo's at the moment of the query (`sqlLocalModifier` in `src/domain/stats/stats.ts`, from
`src/domain/time.ts`); periods are turned into UTC bounds with `localToInstant`. Migration 4 adds the
indexes the statistics read: `requests(assignee_id, created_at)`, `feed_events(request_id)`,
`feed_events(actor_id)` and `petisco_movements(request_id)`. The history lists at most
`HISTORY_LIMIT` (200) requests; the counts and metrics cover all of them.
**Why:** Workers Free gives 10 ms of CPU per request (ADR-006). Formatting each row's date with
`Intl` costs microseconds per row; SQLite's aggregates cost far less. One offset for every row is
exact because Brazil has had no daylight saving since 2019, before the group's first request.
**Alternatives:** Loading the rows and grouping in JavaScript with `monthKey` (exact for any zone,
but its CPU grows with the history); storing a local month column on each request (a write-path
change this read-only slice must not make).
