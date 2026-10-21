# ADR-010: TMDB lookups run in the Worker, before the Group

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** Queries and commands that need TMDB (`media.search`, `media.preview`,
`request.create` with origin `tmdb`) are listed in `server/application/tmdb.ts`. For those, the
Worker first checks the session (`Group.isSignedIn`), then calls TMDB through the `Tmdb` port
(`server/infrastructure/tmdb-client.ts`, API v3, `language=pt-BR`), then calls `Group.query` or
`Group.command` with the result as a fourth argument, `prefetched`. The app cannot fill
`prefetched`: it is a separate RPC argument that only the Worker sets, and the Group never reads
media data from the app's input. The TMDB answer is checked field by field before it is stored
(integer id, bounded title, `YYYY-MM-DD` dates, poster paths matching `/name.jpg`). The secret
`TMDB_API_KEY` holds either a v3 API key (sent as `api_key`) or a v4 read access token (sent as
`Authorization: Bearer`, recognized by its dots). The "Ainda não lançado" badge uses TMDB's primary
release date (`release_date`, or `first_air_date` for series), not the Brazilian one.
**Why:** The Group's methods are synchronous so that a command runs alone in one transaction
(ADR-006); an `await` inside the Durable Object would let another call interleave. The duplicate
check and the petisco reservation need the TMDB data and the database together, so the Worker
fetches first and the Group decides. Checking the session first keeps signed-out callers from
spending the TMDB quota and the Worker's CPU.
**Alternatives:** Calling TMDB from the app (the key would be in the bundle, and the app would need
another origin in `connect-src`); trusting media data sent by the app (anyone could store any title
and poster); an async step inside the Durable Object with input/output gates (gives up the "one call
at a time" invariant for these commands).
