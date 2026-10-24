# ADR-016: The Paçocast, an agent at home that polls the Worker

**Status:** Accepted
**Date:** 2026-10-24
**Decision:** A small agent, the Paçocast (`pacocast/pacocast.ts`), runs in Docker next to the
attendant's Jellyseerr 2.7.3. Every 45 seconds (at least 30, `PACOCAST_INTERVAL_SECONDS`) it calls
`GET /api/pacocast/work`, creates each Solicitado request in the Jellyseerr
(`POST /api/v1/request`, series with `seasons: 'all'`), reads the media status of the ones the
Jellyseerr already has (`GET /api/v1/movie|tv/{tmdbId}`, `mediaInfo.status` and its latest
request), translates it into a `JellyseerrState` and sends them with `POST /api/pacocast/report`.
The Worker accepts both routes only with `Authorization: Bearer <PACOCAST_TOKEN>`, a Worker secret
compared in constant time; without the secret the routes answer 404. The `Group` applies each
report through `actionFor` (`src/domain/request/jellyseerr.ts`) and the lifecycle's `transition`
with the actor `jellyseerr`, so a repeated report changes nothing. The agent is one TypeScript file
with no dependencies, run as is by Node 24 (type stripping) in `node:24.19.0-alpine`; it is
type-checked and tested with the rest of the repository.
**Why:** The spec forbids opening anything at the attendant's home, so the cloud cannot call the
Jellyseerr; the agent can, and only with outgoing connections. Polling also follows the status
after the request: the Jellyseerr's webhook has no "partially available" notification, which the
new Parcialmente disponível status needs, so the agent would have to look the status up anyway.
With the agent reading it, the webhook (its secret, its admin screen, `webhook_events`) is not
needed. The rules stay in the shared domain, where they are tested; the agent only translates the
Jellyseerr's numbers.
**Alternatives:** The Jellyseerr webhook for Available and failures, plus the agent only for
creating requests (two channels and two secrets, and still no partial status); a tunnel to the
Jellyseerr (opens the home network); a WebSocket from the agent to the Durable Object (faster, but
a long-lived connection to keep alive for a group that asks a few times a day); running the agent
on Cloudflare (it cannot reach a Jellyseerr on localhost).
