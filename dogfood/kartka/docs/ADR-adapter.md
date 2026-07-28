# ADR: Astro Bun adapter choice

**Decision**: use `@wyattjoh/astro-bun-adapter` with **Astro 6.4.8**, not
`@nurodev/astro-bun-adapter` and not Astro 7.

## What happened

The spec named `@astrojs/node` as explicitly wrong (Node-only, not what we
want under Bun) and suggested "the community Bun adapter" without pinning a
specific package. Two exist on npm:

- `@nurodev/astro-bun-adapter` (npm reports v2.0.10 in the registry search
  index) — `bun add` against it 404s (`GET .../@nurodev%2fastro-bun-adapter -
  404`). Whatever state that package is in, it isn't currently installable
  from the npm registry in this environment.
- `@wyattjoh/astro-bun-adapter` (v2.1.1) — installs cleanly and has a
  maintained README describing exactly the feature set we need (`output:
  "server"`, static asset serving with ETag/immutable caching for
  `/_astro/*`, optional ISR).

**Chosen: `@wyattjoh/astro-bun-adapter`.**

## Astro version

`@wyattjoh/astro-bun-adapter@2.1.1` requires **Astro 6** (its own README:
"v2.0.0 Breaking Change: This version requires Astro 6"). `bun add astro`
installs the latest major (7.1.5) by default, which the adapter's peer
dependency rejects. Downgraded to `astro@6.4.8` (latest 6.x) to match.

## Verification

`bun run build` (`varlock run -- astro build`) succeeds and produces
`dist/server/entry.mjs`; running it with `bun ./dist/server/entry.mjs`
(via `varlock run --`) serves pages and correctly triggers DB
creation/migration + admin seeding on first request. See docs/RUNNING.md.
