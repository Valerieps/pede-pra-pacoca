# ADR-018: The catalog as a table the library sync fills, filtered on the phone

**Status:** Accepted
**Date:** 2026-10-25
**Decision:** The Catálogo (`docs/spec/catalogo.md`) reads one table, `catalog_items` (migration 6,
`server/application/schema.ts`), keyed by `media_key` and holding what the screen shows: title,
year, poster, genres, seasons and the IMDb, TMDB and Rotten Tomatoes scores. The library sync,
still to be built, will be the only writer; until it fills a title, the query `catalog`
(`server/application/catalog.ts`) adds the latest Cãopleto or Parcialmente disponível request of
each TMDB title that is missing, without scores. The query returns the whole catalog in one
response, and the app searches, filters, sorts and groups it on the phone
(`src/domain/catalog/catalog.ts`). Problems live in `media_problems`, a copy of the title and poster
in each row, so a problem stays readable after the title leaves the library; the commands
`problem.report` and `problem.resolve` and the query `problems` change and read it, and the live
topic `problems` refreshes the catalog and Gerenciar pedidos.
**Why:** The app never talks to the attendant's home (`docs/SPEC.md`), so the library has to be
copied into the group's database, like the request status the Paçocast reports (ADR-016). A home
library of a few thousand titles is a few hundred kilobytes of JSON: one response keeps search and
filters instant and offline-tolerant, and the Durable Object does no per-keystroke work. Scores
stored with the title avoid an OMDb call per card, which the free key would not allow.
**Alternatives:** Paged and filtered queries on the server: more round trips and code for a list
that fits in memory. Reading the scores live per card, as the request page does (`media.imdb`):
hundreds of OMDb calls per screen. Showing only the requests the app made: the owner asked for the
whole library.
