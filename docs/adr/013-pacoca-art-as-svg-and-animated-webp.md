# ADR-013: The Paçoca's art as static SVG and animated WebP

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** Illustrations (empty states, notices, the manual request card, the app icon) are
static SVG files with solid colors, no filters, no embedded images and no scripts. Animations (the
request confirmation and Atendido) are animated WebP: 512 × 512 px, transparent background, 24
frames per second, at most 1.6 s, played once (loop count 1). Each animation comes with a still
frame (SVG or PNG) that the app shows under `prefers-reduced-motion: reduce`. Files are named
after the moment, as `pacoca-confirmacao.webp` and `pacoca-confirmacao-parada.svg`, live in
`public/art/` and are served from the app's own origin. They are drawn with `<img>`, never inlined
as markup, so an SVG cannot run anything. The swap touches `PacocaCelebration.tsx` and
`EmptyState.tsx` only. The piece list and the style are in
[`docs/rascunhos/brief-artes-pacoca.md`](../rascunhos/brief-artes-pacoca.md).
**Why:** `docs/SEGURANCA.md` asks for minimal dependencies and nothing from a CDN; WebP animates
in every browser the app targets with a plain `<img>`, so no player library is needed. A WebP
that plays once and a still frame keep the spec's rule that the Paçoca stands still with reduced
motion (`docs/spec/identidade.md`). 512 px covers the 128 px slot at 4× density; 1.6 s at 24 fps
keeps each file small enough for the first load on a phone.
**Alternatives:** Lottie: smaller and vector, but needs `lottie-web` (a large dependency that
evaluates JSON at runtime) and an export pipeline from After Effects. CSS or SMIL animation inside
the SVG: no dependency, but asks the artist to animate in code and an inlined SVG would be
markup from a file. Video (MP4/WebM): transparency support is uneven and autoplay rules differ by
browser. GIF: no real transparency and much larger files.
