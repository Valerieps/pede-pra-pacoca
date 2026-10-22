# ADR-015: The theme is chosen per device, through a data-theme attribute

**Status:** Accepted
**Date:** 2026-10-21
**Decision:** The dark tokens in `src/ui/theme/tokens.css` apply under `:root[data-theme='dark']`
instead of a `prefers-color-scheme` media query. `src/infrastructure/theme.ts` keeps the choice
(`system`, `light` or `dark`) in `localStorage` under `theme`, resolves it against the phone's
`prefers-color-scheme` and sets `data-theme` on `<html>` before the first render (`startTheme` in
`src/main.tsx`), following the phone's changes while the choice is `system`. It also sets both
`theme-color` metas to the background of the theme shown.
**Why:** The spec lets me pick Claro, Escuro or Igual ao aparelho, for this device only, so the
choice never reaches the server. A single attribute keeps every dark color written once; a media
query plus a forced-theme selector would repeat the whole dark block.
**Alternatives:** CSS `light-dark()` driven by `color-scheme` (not in Safari before 17.5, which
would break every color on older iPhones); storing the choice on the member (the spec asks for one
per device).
