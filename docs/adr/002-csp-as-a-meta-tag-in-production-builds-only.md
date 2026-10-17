# ADR-002: CSP as a meta tag in production builds only, driven by network-policy.ts

**Status:** Accepted
**Date:** 2026-10-17
**Decision:** `vite.config.ts` injects the Content-Security-Policy as a meta tag in production
builds. Its `connect-src` comes from `network-policy.ts`: `'none'` when the list is empty, exactly
the listed origins otherwise. `src/security.test.ts` reads the same file, so the CSP, the source scan
and the docs agree. The other headers live in `public/_headers`.
**Why:** The dev server needs a websocket for hot reload, which a closed `connect-src` blocks. As an
HTTP header the CSP would also apply to a service worker and could stop it caching the app's own
files. One file for the allowed origins keeps the rule from drifting between config and tests.
