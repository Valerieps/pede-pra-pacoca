# ADR-006: Cloudflare Workers backend with one Durable Object for the whole group

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** One Cloudflare Worker (`server/entry/worker.ts`, configured in `wrangler.jsonc`) serves
the built app from `dist/` (static assets, single-page fallback), the API under `/api`, the live
connection and the cron. All group data lives in a single SQLite-backed Durable Object, `Group`
(`server/entry/group-object.ts`), addressed by the fixed name `grupo`. The app never reaches the
database: it calls `POST /api/query/<name>` and `POST /api/command/<name>`, typed by
`src/application/api-contract.ts`.
- **Commands:** the Durable Object runs one call at a time. `GroupService` (`server/application/`)
  checks the member and the role, applies the domain rules (`src/domain/`) and writes everything
  the command causes (request, petisco movements, feed event, notifications) inside one
  `transactionSync`. Use cases are synchronous and depend only on the `Sql`, `Clock` and
  `IdGenerator` ports, so tests run them on `node:sqlite`.
- **Live updates:** each open app keeps one WebSocket to `/api/live`, accepted with the hibernation
  API. After a command, the object sends `{type: 'changed', topics}`; screens refetch those topics,
  and refetch everything after a reconnect.
- **Time-based jobs:** one cron every 5 minutes calls `Group.tick()`; the rules decide what is due
  in America/Sao_Paulo, since cron runs in UTC. Monthly petiscos need no job: they are a monthly
  quota computed from the ledger (`src/domain/petisco/ledger.ts`).
- **Plan:** Workers Free. Durable Objects with SQLite storage and cron triggers are included.
- **Deploy:** Workers Builds, connected to the GitHub repository, runs `npm run build` and deploys
  `main`; other branches get a preview version. The build ends with `wrangler deploy --dry-run`, so
  CI catches a Worker that does not bundle.
- **Phase 2:** the home agent will call two authenticated endpoints using only outgoing connections
  (claim the "A enviar" queue, report the result). Nothing is built for it now.

**Why:** The owner chose Cloudflare. There is one small group, so one object holds all of it:
writes are serialized and transactional without locks, and the same object holds the live
connections. Workers static assets replace Cloudflare Pages because Pages Functions cannot have
cron triggers or define Durable Objects. One Worker means one origin, so the app's CSP is
`connect-src 'self'`.
**Alternatives:** D1 (no interactive transactions and no live updates; a command touching request,
ledger and feed would need optimistic checks); Pages plus a separate Worker for the cron (two
deploys, two origins); Firebase (ADR-004, superseded).
**Limits to watch:** Workers Free allows 10 ms of CPU per request and 100,000 requests a day. Web
Push encryption and large reports are the likely first to hit it; the fix is the US$ 5 Workers Paid
plan, not a redesign. The data cannot be browsed in a dashboard as with D1: an admin export is on
the roadmap.
