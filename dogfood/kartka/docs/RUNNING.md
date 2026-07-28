# Running Kartka

## Setup

```bash
bun install         # also runs `varlock codegen` via postinstall (typed env)
cp .env.schema .env # then edit .env if you want non-default values
```

`.env.schema` documents every variable (see `docs/ADR-varlock.md`). Defaults
are sane for local dev: `DB_DRIVER=sqlite`, db file at `./data/kartka.db`.
`SESSION_SECRET` ships with an obviously-insecure placeholder
(`dev-only-insecure-secret-change-me`) — replace it for anything beyond a
laptop, e.g. `openssl rand -hex 32`.

## Dev server

```bash
bun run dev
```

Starts Astro's dev server under Bun via `varlock run` (required — see
`docs/ADR-varlock.md` point 2). Visit http://localhost:4321.

## Tests

```bash
bun test        # or: bun run test
```

Covers `sm2.ts` (multiple quality sequences + the easiness floor), the
Levenshtein fuzzy-match helper, and a full `createSet → addCard →
listCardsInSet` use-case flow (with pagination) against a temp sqlite file
via the real `bun:sqlite` driver.

## Build + run for real

```bash
bun run build     # astro build (SSR, Bun adapter) -> dist/server/entry.mjs
bun run start     # varlock run -- bun ./dist/server/entry.mjs
```

## First login

On first boot (first request that touches the database), if there are no
users yet, Kartka seeds one admin account and logs the generated password to
the console **once**:

```
Kartka: no users found — seeded a first admin account.
  email:    admin@kartka.local
  password: <random, printed once>
```

Log in with those credentials, then use `/admin` (role-gated — 403s for
non-admins) — its actual functionality ships in slice 4; right now it just
confirms the seam ("Admin panel — coming in slice 4").

There's no self-service password change yet in slice 1 (see `docs/TODO.md`).

## Switching to Postgres

```bash
DB_DRIVER=postgres
DATABASE_URL=postgres://user:pass@host:5432/kartka
```

No code changes — `src/adapters/db/index.ts` picks the driver at boot. The
Postgres path uses Drizzle's native `bun-sql` driver (`Bun.sql` under the
hood), so no `pg` npm package is required.
