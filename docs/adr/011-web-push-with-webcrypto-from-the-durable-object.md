# ADR-011: Web Push with WebCrypto, sent by the Durable Object from the outbox

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** Notifications follow the outbox pattern of `docs/ARQUITETURA.md`, and push is Web Push
signed with VAPID and encrypted with aes128gcm, written on WebCrypto with no npm package.
- **Writing:** a feature calls `notify` (`server/application/notifications.ts`) inside its command.
  The domain (`src/domain/notification/`) picks the recipients, their switches, quiet hours, the
  daily digest and the hourly grouping of likes; `notify` writes the inbox row at once and an
  `outbox` row with `deliver_after`, in the command's transaction. Grouped notices (likes of one
  event, one attendant's digest) merge into the pending row by `group_key`. The text is rendered
  when shown (`render.ts`, `strings.ts`), never stored.
- **Sending:** use cases stay synchronous, so the network part lives in the Durable Object
  (`server/entry/group-object.ts`). `claimDuePushes` marks due rows as sent and returns the jobs;
  the object encrypts and posts them (`server/infrastructure/web-push.ts`) and drops the
  subscriptions the push service answers 404 or 410 for. It runs after any command whose topics
  include `notifications` (at most 5 pushes) and on the 5-minute cron (at most 10). Delivery is at
  most once: a failed push is not retried, the inbox still has it. Rules that may have changed
  since queuing (removed member, switched off, vacation, quiet hours) are checked again when sending.
- **Crypto:** RFC 8291 and RFC 8188 in one record (4096-byte record size, no padding), a fresh
  ECDH key and salt per push; RFC 8292 VAPID with an ES256 JWT, cached per push service for 6 of
  its 12 hours. Keys from `npm run vapid:keys`, stored as the secrets `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Without them the app still works and notices reach the
  inbox only.
- **Endpoints:** `PUSH_SERVICE_ORIGINS` in `network-policy.ts` (FCM, Apple, Mozilla) is part of
  `SERVER_ORIGINS`. `push.subscribe` refuses any other endpoint and the sender checks it again
  before each call. A member keeps at most 10 devices; a device that signs in as someone else
  moves to them.
- **App:** `public/sw.js` shows the push and, on a tap, focuses the open app and asks it to
  navigate (or opens the path). It caches nothing and calls no server. The page's CSP is a meta tag
  (ADR-002), so it does not restrict the worker; `src/security.test.ts` checks that the worker has
  no network calls or external URLs. On every start the app sends its current subscription, which
  heals one the server dropped or one made with an old key.

**Why:** ADR-001 allows no runtime npm package on the Worker, and WebCrypto has everything Web
Push needs (ECDH, HKDF, AES-GCM, ECDSA). The outbox keeps the rule "everything a command causes
commits together", and quiet hours, digest and likes become one `deliver_after` column. Workers
Free gives little CPU per call (ADR-006): small batches and the cached JWT keep each call at a few
encryptions; the cron catches up on the rest.
**Alternatives:** an npm Web Push library (needs Node's crypto, against ADR-001); sending inside the
command (async inside the transaction is not possible, and a slow push service would hold the
group's only object); Durable Object alarms per notice (more moving parts than the cron that
already exists). Edge on Windows uses its own push service (WNS) and is left out: the group uses
phones.
