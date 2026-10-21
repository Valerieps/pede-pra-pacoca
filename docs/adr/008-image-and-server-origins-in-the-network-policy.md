# ADR-008: Image and server origins in network-policy.ts

**Status:** Accepted, updated by ADR-011
**Date:** 2026-10-21
**Decision:** `network-policy.ts` has three lists. `ALLOWED_ORIGINS`: third-party origins the app
may connect to besides its own (empty). `IMAGE_ORIGINS`: `https://image.tmdb.org` (posters) and
`https://lh3.googleusercontent.com` (Google profile photos), added to the CSP `img-src`.
`SERVER_ORIGINS`: the only servers the Worker calls (Google sign-in and TMDB; the push services
join when notifications are built). `src/security.test.ts` checks every URL in `src/` against the
first two and every URL in `server/` against the third.
**Why:** The owner approved loading posters and photos directly. Proxying them through the Worker
would spend requests and CPU of the free plan, and would only hide the viewer's IP from TMDB and
Google. Listing the server's origins keeps "one place says which servers" true on both sides, and
gives the push sender an allowlist against arbitrary subscription endpoints.

**Update (2026-10-21):** The push services joined as `PUSH_SERVICE_ORIGINS`, spread into
`SERVER_ORIGINS`: FCM, Apple and Mozilla (ADR-011).
