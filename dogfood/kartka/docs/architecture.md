# Architecture

Kartka is built hexagonally so the domain rules (SM-2 scheduling, card
validation, pagination semantics) stay testable and framework-free.

```
src/core/domain/     pure types + logic. Zero imports from adapters/*, astro:*,
                     or any framework. sm2.ts, levenshtein.ts, cloze.ts,
                     cardValidation.ts, quality.ts, errors.ts, types.ts.
src/core/ports/      interfaces the domain/usecases depend on:
                     SetRepoPort, CardRepoPort, UserRepoPort, SchedulerPort,
                     AuthPort, LlmGeneratorPort (slice 2 seam, unimplemented).
src/core/usecases/   orchestration functions. Take ports as arguments (or via
                     a small object), no framework imports, no astro:* imports.
src/adapters/db/     Drizzle implementations of the repo ports, split by
                     driver (setRepo.sqlite.ts / setRepo.pg.ts, etc.) — see
                     "why two schema files" below.
src/adapters/auth/   session-cookie auth: Bun.password hashing + HMAC-signed
                     cookie values, split by driver (sessions live in the db).
src/di/container.ts  composition root. Builds the right adapters for
                     DB_DRIVER, wires usecases, exposes getContainer().
src/pages/           Astro routes. Thin: call a usecase via getContainer(),
                     render the result. No business logic here.
src/components/      Astro/htmx partial templates.
src/i18n/            pl.json, en.json + t(key, locale) helper.
src/lib/             glue that doesn't belong in core or a specific adapter
                     (session cookie plumbing, pagination query parsing, hand-
                     built htmx fragment renderers).
```

## The boundary rule

`src/core/**` must never import from `src/adapters/**`, `src/pages/**`,
`src/components/**`, `astro:*`, or any Astro/htmx-specific API. Ports are the
only thing core exposes outward; adapters implement ports, usecases consume
ports. This is enforced informally (no lint plugin wired up for slice 1) —
when reviewing a diff, check every `import` at the top of a `src/core/**` file.

## Why two schema files (schema.sqlite.ts / schema.pg.ts)

Drizzle's sqlite-core and pg-core column builders are genuinely different
APIs (e.g. `integer(..., { mode: "timestamp_ms" })` vs `timestamp(...)`,
`text(..., { mode: "json" })` vs `jsonb(...)`), so a single shared schema
module isn't practical. The two files are kept field-for-field identical by
hand; `src/adapters/db/index.ts` picks which one to load based on
`DB_DRIVER`. The same split applies to the repo adapters
(`*Repo.sqlite.ts` / `*Repo.pg.ts`) and the auth adapter
(`authAdapter.sqlite.ts` / `authAdapter.pg.ts`) for the same reason — the
`Session`/`ReviewState` etc. row shapes differ by a type parameter that isn't
worth abstracting over for two drivers.

## Migrations

Slice 1 does not use drizzle-kit's migration generator. `src/adapters/db/migrateSqlite.ts`
and `migratePg.ts` run idempotent `CREATE TABLE IF NOT EXISTS` DDL directly —
appropriate for a greenfield slice with no prior schema to migrate *from*.
`drizzle-kit` is still a devDependency so a future slice can switch to
generated migrations once there's an actual schema history to manage; see
docs/TODO.md.
