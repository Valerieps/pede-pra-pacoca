# ADR-012: Web Share Target by GET, read once and cleared from the address

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** `public/manifest.webmanifest` declares a `share_target` with `method: "GET"` and
`action: "/compartilhar"`, mapping `title`, `text` and `url`. At startup, before rendering,
`src/main.tsx` calls `captureShare` (`src/infrastructure/share-target.ts`): on `/compartilhar` it
joins the three fields (link first, length capped), keeps the text in memory and in the tab's
`sessionStorage`, and replaces the address with `/pedir` through `history.replaceState`, so the
shared text leaves the address bar and the history. The Pedir screen takes the text once
(`parseSharedLink`, which searches the whole text) and clears it. If the person was signed out,
the text survives the Google sign-in round trip in `sessionStorage`, and `App` opens `/pedir` once
the app is ready.
**Why:** The spec wants Android's share menu to open the same confirmation as the paste field
(`docs/spec/app-e-instalacao.md`). GET needs no service worker handler: the Worker's
single-page-application fallback serves `index.html` for `/compartilhar`, and `public/sw.js`
stays push-only. The shared text is a link put in the URL by the operating system, not personal
data the app chose to put there (`docs/SEGURANCA.md`); clearing it right away keeps it out of the
history, and `Referrer-Policy: no-referrer` keeps it from leaking onward.
**Alternatives:** POST with `multipart/form-data`, handled by the service worker: keeps the text
out of the URL but needs a fetch handler in `sw.js` and a hand-off to the page, for a link that
is not sensitive. Reading the query in the Pedir screen itself: the text would stay in the address
bar and be lost on the sign-in redirect.
