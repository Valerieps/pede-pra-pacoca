# ADR-019: The Catálogo keeps the scores the media page looks up

**Status:** Accepted
**Date:** 2026-10-25
**Decision:** The query `media.imdb` (the request page's IMDb, TMDB and Rotten Tomatoes scores,
looked up by the Worker on TMDB and OMDb) also stores them in `media_scores` (migration 7,
`server/application/schema.ts`), keyed by `media_key`, through `storeScores` in
`server/application/catalog.ts`. The `catalog` query joins that table into the titles that come
from requests, and says per title whether its scores are fresh (`scoresKnown`: stored less than
`SCORES_MAX_AGE_DAYS`, 30, days ago; a synced `catalog_items` row counts from `synced_at`). The
Catálogo screen (`useScoreLookups` in `src/ui/screens/Catalog.tsx`) calls `media.imdb` for each
title without fresh scores, one at a time, then reloads the list once.
**Why:** Until the library sync of ADR-018 exists, the catalog's titles have no scores, and the
owner wants the IMDb score and the others on the list and the grid now. Kept per title, a lookup
happens once a month per title, not per card per visit, which the free OMDb key allows; the
request page fills the same table when someone opens it.
**Alternatives:** Looking the scores up per card on every visit, as ADR-018 rejected. Looking them
up when a request becomes Cãopleto: the Paçocast's status report goes through the Durable Object,
which does not call TMDB (ADR-006), and the titles already in the library would stay empty. When
the library sync arrives with its own scores, its rows win, and this table only serves the request
page.
