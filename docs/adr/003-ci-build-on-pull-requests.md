# ADR-003: CI build on pull requests and a protected main

**Status:** Accepted
**Date:** 2026-10-17
**Decision:** `.github/workflows/ci.yml` runs `npm run build` (typecheck, unit tests, production
build) and `npm run docs:check` on every pull request and on pushes to `main`. `main` requires the
`build` check on a branch up to date with `main`, and takes no direct pushes; `scripts/setup-repo.mjs`
applies this, since a GitHub template does not copy branch protection. Cloudflare Pages deploys
`main` and gives each branch a preview, which is the staging.
**Why:** Cloudflare runs the build only after the merge; CI catches a broken change before it
reaches `main`. Requiring an up-to-date branch makes the check run against what will be merged.
Private repositories on GitHub's free plan cannot protect branches: there CI still runs, but the
merge is not blocked.
