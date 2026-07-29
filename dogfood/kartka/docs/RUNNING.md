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

## Due-card reminders (slice 9, Web Push)

### VAPID keys

`.env.schema` ships `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` with a real,
already-generated dev keypair — fine for local development, but it's the
**same keypair baked into every clone of this repo**, so it is **not** fine
for a real deployment (anyone with the repo could sign push messages that
look like they came from your server, or decrypt intercepted push traffic).
Generate your own pair before deploying for real users:

```bash
bunx web-push generate-vapid-keys
# or:
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Put the `publicKey` in `VAPID_PUBLIC_KEY` and the `privateKey` in
`VAPID_PRIVATE_KEY` in your `.env`. `VAPID_CONTACT` should be a real
`mailto:` address or `https://` URL a push service could use to contact you
if your server misbehaves.

The public key is intentionally exposed to the browser (rendered into
`account/settings.astro` as a data attribute, read by
`src/client/push/register.ts`) — that's the entire point of VAPID's
public/private key split; only the private key is sensitive
(`@sensitive` in `.env.schema`, never sent to the client).

### Enabling reminders (as a user)

Visit `/account/settings` while logged in, click "Enable reminders" under
"Due-card reminders" (grants the browser Notification permission and
registers a push subscription), and optionally set a quiet-hours window
(see the "known simplification" note in `docs/TODO.md` — the times are
interpreted in the server's UTC clock, not your local timezone).

### Sending reminders — this app has NO built-in scheduler

Kartka is a request/response SSR app with no long-running background
process, so nothing sends reminders automatically. `scripts/send-reminders.ts`
is a standalone script meant to be invoked periodically by an **external**
cron (or systemd timer, etc.) — it is not wired to run on its own:

```bash
bun run send-reminders
# equivalent to: varlock run -- bun scripts/send-reminders.ts
```

Example crontab entry, running every 15 minutes:

```cron
*/15 * * * * cd /path/to/kartka && bun run send-reminders >> /var/log/kartka-reminders.log 2>&1
```

Each run: finds every user with at least one push subscription, computes
their real due-card count via the same review-session logic `/review` uses,
skips anyone with zero due cards, zero subscriptions, or currently inside
their own quiet-hours window, and sends one VAPID-signed push per remaining
subscription. Any subscription whose push service reports it's gone (HTTP
404/410 — the standard "this registration is dead" signal) is deleted
automatically, so a stale subscription doesn't get retried forever.
