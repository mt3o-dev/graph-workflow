# ADR: Live-quiz WebSocket transport (slice 11)

**Decision**: a second `Bun.serve()` process (`live-server.ts`, started via
`bun run live` / `varlock run -- bun live-server.ts`) on its own port
(`LIVE_WS_PORT`, default 4322) owns the live-quiz WebSocket endpoint AND the
"start a session" HTTP endpoint. **No reverse proxy is used** — the browser
connects to the sidecar's port directly. This matches roadmap.md's drafted
plan, but the investigation below confirms *why* it's necessary (not just
assumed) and narrows exactly what has to live in the sidecar vs. the main app.

## What was checked before committing to this

The roadmap's draft said "check first whether `@wyattjoh/astro-bun-adapter`
can upgrade a request to a WebSocket inside an Astro route." It can't:

- The adapter's own README (`node_modules/@wyattjoh/astro-bun-adapter/README.md`)
  documents static serving, ISR, and env vars — no mention of WebSockets
  anywhere.
- Its server entrypoint (`node_modules/@wyattjoh/astro-bun-adapter/dist/server.js`)
  calls `Bun.serve({...})` exactly once, with a `fetch` handler built from
  Astro's SSR manifest. There is no `websocket:` handler configured and no
  hook point for an Astro *page/route* to reach into the adapter's own
  `Bun.serve()` call and register one — Astro's route contract is
  request-in/Response-out; `Response` has no way to represent "please upgrade
  this connection," and the adapter doesn't expose an escape hatch for it.

So the fallback (sidecar `Bun.serve()` process) is the correct call, not an
assumption skipped past.

## Why no reverse proxy is required

The roadmap's draft plan mentioned reverse-proxying the sidecar under
`/live/*` "so it looks like one app to the browser." This slice verified —
rather than assumed — that this isn't necessary for auth to work:

- **Cookies are scoped by `(host, path)`, never by port** (RFC 6265 — the
  cookie's `Domain`/default-host and `Path` attributes are the only scoping
  mechanisms; port is explicitly excluded). Kartka's session cookie
  (`src/lib/session.ts`, `SESSION_COOKIE = "kartka_session"`) is set with
  `path: "/"` and no explicit `Domain`, so it defaults to the exact
  request host — but that host string has no port component. A browser that
  has the cookie for `http://localhost:4321/...` will also send it on a
  request to `http://localhost:4322/...`, because from the cookie jar's
  perspective these are the same host.
- **Verified in this slice**, not just cited: `docs/ADR-live-transport.md`'s
  companion code, `src/lib/session.ts`'s new `getUserFromCookieHeader()`,
  parses the raw `Cookie` header of an incoming request to the sidecar and
  successfully resolves the same signed session the main Astro app set —
  confirmed by the smoke test in the slice 11 report (`POST /live/create`
  without a cookie header returns 401; the same request is accepted once a
  real session's cookie header is attached).
- A WebSocket handshake is an HTTP request before the 101 upgrade, so the
  browser attaches cookies to it exactly like any other cross-port
  same-host request — no special-casing needed on the client side either
  (`new WebSocket("ws://host:4322/live/CODE")` just works, cookie included).

The only thing a reverse proxy would add here is a single origin/URL for
end users to remember — a nice-to-have (and worth doing before a real
production deployment, see "Deferred" below), not a correctness requirement.
This slice ships without one.

## What lives in the sidecar vs. the main Astro app

The in-memory `LiveSessionPort` (see
`src/adapters/liveQuiz/inMemoryLiveSessionPort.ts`) is a single-process
`Map`. Two separate OS processes cannot share that Map. To avoid a
split-brain (a room created in one process being invisible to the other),
**every room mutation — create, join, answer, advance — is handled
exclusively by the sidecar process**:

- `POST /live/create` (HTTP, on the sidecar's own port) — the "Start live
  session" form on `src/pages/sets/[id].astro` posts directly here (a plain
  full-page form submission, not a `fetch`/XHR, so no CORS is involved).
  Verifies the session cookie, checks set ownership via the same
  `getOwnedSet` every other owner-only action in this app uses, then calls
  `createLiveSession` and 303-redirects the browser to
  `{PUBLIC_SITE_URL}/live/{code}` — a normal Astro page, rendered by the
  main app.
- `GET /live/:code` (upgraded to a WebSocket) — join, answer, and advance
  all happen over this single connection once open. The main Astro app's
  `/live/[code].astro` page is a thin SSR shell: it authenticates the user,
  validates the room-code shape, does one cheap SSR-side existence
  pre-check (`GET /live/:code/exists` on the sidecar — see below), and
  renders `hx-ext="ws" ws-connect="ws://host:LIVE_WS_PORT/live/CODE"`. It
  never touches `liveSessionPort` itself.

`Container.liveSessionPort` (see `src/di/container.ts`) is still declared on
the shared composition root and instantiated in both processes (so it's
available like any other port if a future page ever needs read-only access,
e.g. a spectator view), but only the sidecar's instance is load-bearing.
This is called out explicitly in that field's doc comment so a future
change doesn't accidentally split room mutations across both processes.

## The hexagonal boundary still holds

`src/core/domain/liveQuiz.ts` (room-state types + pure transitions +
scoring) and `src/core/usecases/liveQuizUsecases.ts` (orchestration:
ownership checks, join-by-code, answer submission, question sequencing,
scoreboard) have zero imports from `live-server.ts`, `Bun.serve`, or
`WebSocket` — see their header comments. `live-server.ts` is the only file
in this slice that imports both the transport (`Bun.serve`) and the
usecases; everything it does is: parse a request → call a usecase → render
an HTML fragment (`src/lib/liveFragments.ts`) → write it to a socket. This
is exactly the "usecases take ports, adapters implement ports, transport
calls usecases" shape the rest of the app already follows.

## Wire message shapes

**Client -> server** (sent by htmx-ext-ws's `ws-send` forms, which
JSON-encode the form's named fields automatically — see
`node_modules/htmx-ext-ws/dist/ws.js`'s `processWebSocketSend`, which does
`JSON.stringify(toSend)` where `toSend` is the submitted form's fields):

```json
{"type": "answer", "cardId": "card_abc123", "rawAnswer": "1"}
{"type": "advance"}
```

There is no explicit client -> server "join" message: joining happens
implicitly when the WebSocket handshake succeeds (see `live-server.ts`'s
`websocket.open` handler) — the handshake itself, gated on the signed
session cookie, *is* the join. This matches "any logged-in user can join by
code, no separate action needed" from the roadmap.

**Server -> client**: raw HTML fragments (`hx-swap-oob`), NOT JSON — this is
a deliberate asymmetry, not an oversight. htmx's whole model (and this app's,
since slice 1) is "the server owns the markup, the client just swaps it in."
Sending JSON back and having the client template it into HTML would be
exactly the client-side templating this project has avoided everywhere else.
Two swap targets are used (see `src/lib/liveFragments.ts`):

- `#live-room` — the whole room view (lobby / question / reveal / finished).
  Re-rendered and pushed to every connected socket in the room on every
  phase transition (`advancePhase`) and on a new player joining while still
  in lobby.
- `#live-answer-status` — a small per-viewer acknowledgment
  ("submitted, +N" / just "submitted") sent **unicast** (only to the socket
  that submitted) right after `submitLiveAnswer` scores it. This is the one
  place a personalized (not broadcast) message is needed, since a player
  should immediately know their own answer registered without waiting for
  the whole-room reveal.

Host-only controls (the "start quiz" / "next question" buttons) are
rendered into the fragment per-viewer (each socket gets its own render call
via a small in-process `Map<roomCode, Set<ServerWebSocket>>` registry in
`live-server.ts` — deliberately NOT Bun's built-in pub/sub topics, because
topics broadcast one identical string to every subscriber and can't
personalize per-socket). The server is still the actual enforcement point
(`advanceLiveQuestion` throws `ForbiddenError` for a non-host `hostId`) —
hiding the button client-side is a UX nicety, not the security boundary.

## Scoring formula

`core/domain/liveQuiz.ts`'s `scoreAnswer`: 0 points for a wrong/timed-out
answer; a correct answer scores `BASE_POINTS` (1000) plus a linear speed
bonus of up to `MAX_SPEED_BONUS` (500) that decays to 0 right at
`QUESTION_TIME_LIMIT_MS` (20s):
`speedBonus = round(500 * (1 - clamp(elapsedMs, 0, 20000) / 20000))`.

## Room codes

5 characters, drawn from a 31-character alphabet excluding visually
ambiguous glyphs (`0/O`, `1/I/L`), generated via `crypto.getRandomValues`
(same approach as `core/domain/slug.ts`'s share-link slugs, just shorter —
see that file's header for why `crypto.getRandomValues` and not a
sequential/predictable generator). Per the roadmap: **not a security
boundary** — a shared classroom code is inherently guessable/shareable by
design, so entropy isn't over-engineered here the way `slug.ts`'s 10-char
alphabet is for actual share links.

## A blocker this slice's topology exposed (found by review, fixed here)

The sidecar shares `DB_SQLITE_PATH` with the main app and calls the same
`migrateSqlite()` on boot (see "What lives in the sidecar" above). Slice 11
is the **first** thing in this codebase to run `migrateSqlite()` a second
time against an already-migrated file from a separate process — every prior
slice's tests use a fresh per-file sqlite DB, and the main app itself only
calls `migrate()` once per process lifetime. That exposed a real,
pre-existing bug in every `ALTER TABLE ... ADD COLUMN` guard since slice 3:
Drizzle's `db.run()` wraps the underlying bun:sqlite error in its own
`DrizzleQueryError`, whose *own* `.message` is a generic "Failed to run the
query" string — the actual `"duplicate column name: x"` text lives one
level down, on `err.cause.message`. Every guard checked only `err.message`,
so the "already exists, ignore" branch was silently dead code; the sidecar's
first `getContainer()` call on an already-migrated DB threw uncaught, its
memoized container promise cached the rejection, and every subsequent
request 500'd permanently. Fixed centrally in `migrateSqlite.ts` via a
shared `isDuplicateColumnError()` helper that checks both `err.message` and
`err.cause.message`; verified with a real two-connection reproduction
(migrate a fresh file, close it, open a brand-new `Database`/drizzle
instance against the same path, migrate again) both before (throws) and
after (succeeds) the fix, and captured as a permanent regression test in
`tests/migrateSqlite.test.ts`. Postgres's migration path was unaffected —
it uses `ADD COLUMN IF NOT EXISTS` natively, no error-matching involved.

## Deferred / not built in this slice

- **Reverse proxy** under `/live/*` — not required for correctness (see
  above), but worth adding before a real multi-user deployment so end users
  only ever see one origin/port. Left as a follow-up (`docs/TODO.md`).
- **Multi-instance scale-out** — the in-memory `LiveSessionPort` is
  single-process by design (documented MVP limitation, not a blocker per
  the roadmap). A `Bun.redis` pub/sub-backed adapter implementing the same
  `LiveSessionPort` interface is the intended upgrade path; zero changes
  needed in `core/domain` or `core/usecases` to support it.
- **Room expiry/cleanup** — rooms live for the sidecar process's lifetime
  and are never explicitly deleted from the Map. Fine for a dogfood/MVP
  scope (restarting the sidecar clears everything); a TTL sweep would be a
  small addition if this becomes a real concern.
- **Clean "room not found" surfacing for the rare race** where a room
  existed at page-load (SSR pre-check passed) but is gone by the time the
  socket connects — htmx-ext-ws's default reconnect behavior retries
  forever on an abnormal-closure code instead of surfacing an error. Not
  practically reachable in this MVP (nothing currently deletes a room mid-
  session), but noted as a known rough edge if room-expiry is added later.
