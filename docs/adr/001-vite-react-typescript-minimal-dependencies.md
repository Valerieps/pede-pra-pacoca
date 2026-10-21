# ADR-001: Vite + React + TypeScript, minimal dependencies

**Status:** Accepted, updated by ADR-006
**Date:** 2026-10-17
**Decision:** Runtime dependencies are React and React DOM only. Build and test tooling: Vite,
TypeScript and Vitest. All versions are pinned exactly and installed with `npm ci`. No lint tool
by default: `src/security.test.ts` covers the security rules and `tsc` the strictness.
**Why:** Every dependency is supply-chain risk and upkeep (`docs/SEGURANCA.md`). Vite builds static
files that any static host serves; Vitest shares its config.

**Update (2026-10-21):** The backend adds two development dependencies: `wrangler` (local Worker,
bundling, deploy) and `@cloudflare/workers-types`. Runtime dependencies stay React and React DOM;
the Worker uses no npm package: Google sign-in, hashing and, later, Web Push use WebCrypto. Server
tests run on Node's built-in `node:sqlite`, with no extra test tooling.
