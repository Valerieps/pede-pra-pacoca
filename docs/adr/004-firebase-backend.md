# ADR-004: Firebase as the backend

**Status:** Superseded by ADR-006
**Date:** 2026-10-20
**Decision:** The backend is Firebase: Auth (Google sign-in only), Firestore, Cloud Functions, Cloud
Scheduler and Cloud Messaging. Functions own every sensitive write (status, token ledger, invites,
config), the Jellyseerr webhook and the TMDB proxy; Firestore rules deny those writes to clients.
`network-policy.ts` lists the Firebase origins the app talks to. The Functions origin is added once
the Firebase project exists. Using Functions and Scheduler needs the Blaze plan (a card on file); the
projected usage stays inside the free quotas, and a budget alert is set at R$ 5.
**Why:** The spec needs login, push, scheduled jobs and a public webhook, with no server at home
(`docs/spec/jellyseerr.md`). Firebase covers all of it with one provider, no servers to run, and
usage far below the free quotas for one group of a few dozen people.
**Alternatives:** Supabase and Cloudflare Workers + D1 were considered; Firebase has push and
scheduled jobs built in, and the owner chose it.
