# ADR: varlock integration

**Decision**: `.env.schema` declares every env var; the app is always run
through `varlock run -- <cmd>` (see the `dev`/`build`/`start`/`test` scripts
in `package.json`); `src/env.ts` calls `initVarlockEnv()` once, at the very
top of the import graph (`src/adapters/db/index.ts` and
`src/di/container.ts` both `import "../env"` before touching `process.env`).

## Deviations from the spec's assumed API

1. **`@defaultSensitive=false` is required at the schema root.** Without it,
   varlock's real default is "every var is sensitive unless it has a
   `@sensitive=false`-equivalent," not the other way around — every field
   (including `DB_DRIVER`, `PORT`, etc.) showed up marked 🔐 sensitive under
   `varlock load`, which both over-redacts harmless config in logs and isn't
   what the spec's example schema implies (only `OPENROUTER_API_KEY` should
   be sensitive). Root decorator added:
   ```
   # @defaultSensitive=false
   ```
   `SESSION_SECRET` and `OPENROUTER_API_KEY` are still marked `@sensitive`
   explicitly.

2. **`initVarlockEnv()` (from `varlock/env`) throws unless the process was
   launched via `varlock run`.** Calling it from a plain `bun run script.ts`
   fails with "initVarlockEnv failed — try rerunning your command via
   `varlock run`". This is why every script in `package.json` is wrapped:
   `"dev": "varlock run -- astro dev"`, etc. There is no code-level
   "just resolve the schema in-process" fallback that works standalone in
   this version — `varlock run` (or the CLI wrapping the process) is load-bearing.

3. **Typed `ENV` access requires `varlock codegen`.** `varlock/env`'s
   `TypedEnvSchema` interface is empty (`{}`) until you generate types.
   Schema root decorator:
   ```
   # @generateTsTypes(path=src/env.gen.d.ts)
   ```
   `bun add`'s `postinstall` script runs `varlock codegen` so this file is
   regenerated automatically after `bun install`; it's gitignored (derived
   from `.env.schema`, not hand-maintained) — see `.gitignore`.

4. **`DATABASE_URL` and `OPENROUTER_API_KEY` needed explicit `@optional`.**
   Marking a var `@sensitive` without also either giving it a default value
   or marking it `@optional` makes it required — both are legitimately empty
   in slice 1 (sqlite is the default driver; the LLM key isn't used yet), so
   both got `@optional @sensitive`.

None of this changes the developer-facing contract described in the spec
(one `.env.schema`, one `.env`, `DB_DRIVER`/`DB_SQLITE_PATH`/`DATABASE_URL`/
`SESSION_SECRET`/`OPENROUTER_API_KEY`/`PORT`/`PUBLIC_SITE_URL` all present) —
it's all schema-file decorators and script wrapping, not an API workaround
that leaks into application code.
