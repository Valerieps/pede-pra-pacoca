# ADR-001: Vite + React + TypeScript, minimal dependencies

**Status:** Accepted
**Date:** 2026-10-17
**Decision:** Runtime dependencies are React and React DOM only. Build and test tooling: Vite,
TypeScript and Vitest. All versions are pinned exactly and installed with `npm ci`. No lint tool
by default: `src/security.test.ts` covers the security rules and `tsc` the strictness.
**Why:** Every dependency is supply-chain risk and upkeep (`docs/SEGURANCA.md`). Vite builds static
files that any static host serves; Vitest shares its config.
