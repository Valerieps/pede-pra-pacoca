# ADR-017: Group numbers ranked in SQL, Farejando time read from the transitions

**Status:** Accepted
**Date:** 2026-10-24
**Decision:** The new Números do Grupo (`server/application/statistics.ts`, query `stats.numbers`)
replaces the analysis screen and its queries `stats.profile` and `stats.group`. Each podium and
trophy is one SQLite `GROUP BY` with `ORDER BY count DESC, MAX(<date>)` and `LIMIT 3`, so a tie
goes to whoever reached the number first. "Todo mundo também quer" groups by
`COALESCE(media_key, id)` over the requesters and `co_requests`. The time in Farejando needs no
migration: every status change already goes through `setStatus` (`server/application/requests.ts`),
which writes a `request_transitions` row with its time. The server reads only the rows that enter or
leave `in_jellyseerr` and `farejandoMs` (`src/domain/stats/stats.ts`) adds the stretches, clipped to
the period, a request still in Farejando counting up to now. "Últimos 30 dias" is the last 30 × 24
hours, so no local calendar is involved. The indexes migration 4 added for the old screen stay.
**Why:** Workers Free gives 10 ms of CPU per request (ADR-006); the rankings stay in SQL as in
ADR-014. The transitions table already holds the history, so old requests have the Farejando time
too, and a pure function keeps the clipping rules unit-tested.
**Alternatives:** A new column or table with the time each request entered and left Farejando
(duplicates `request_transitions` and leaves old requests without the data); computing the stretches
with SQL window functions (harder to read and test than a loop over a few rows per request).
