# ADR-005: Installable web app on Cloudflare Pages, no app stores

**Status:** Accepted, updated by ADR-006
**Date:** 2026-10-20
**Decision:** The app is a mobile-first web app (PWA) hosted on Cloudflare Pages, with no native
wrapper and no store listing. On Android, sharing a link to the app uses the Web Share Target; on
iOS the user pastes the link (`docs/spec/app-e-instalacao.md`). Push on iOS needs the app installed to
the home screen. Login is Google only.
**Why:** The group is small, store accounts cost money and paperwork, and the template already
deploys to Cloudflare Pages with preview per branch (ADR-003). Apple sign-in needs a paid
developer account even on the web.
**Alternatives:** Capacitor native app (rejected: stores); Firebase Hosting (rejected: the template
is already wired for Cloudflare Pages, which has unlimited free bandwidth and keeps hosting out of
the Google bill).

**Update (2026-10-21):** The app is served by a Cloudflare Worker with static assets instead of
Cloudflare Pages (ADR-006), and push uses standard Web Push instead of Firebase Cloud Messaging.
The rest stands: installable web app, no stores, Web Share Target on Android, paste on iOS.
