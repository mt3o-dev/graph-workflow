# Running the Tauri e2e suite

This suite is authored here but **cannot run on the machine that built it** —
that machine is Node 26 + pnpm only, with no Rust/cargo toolchain, no Docker,
no GPU (see `../docs/deferred-verification.md`). `pnpm typecheck`,
`pnpm test`, and `pnpm build` never depend on anything in this directory.

## What's here

- `wdio.conf.ts` — WebdriverIO config that drives the Tauri webview through
  `tauri-driver` (tech-stack.md decision 11: Playwright cannot attach to a
  Tauri webview; `tauri-driver` is the officially supported WebDriver bridge
  on Linux/Windows).
- `preflight.ts` — checks that `tauri-driver` is on `PATH` and that a debug
  Tauri binary exists, before wdio ever tries to attach. Exits 1 with an
  actionable message if either is missing (this is `pnpm test:e2e`'s first
  step, so the whole command fails fast and clearly instead of hanging).
- `smoke.e2e.ts` — app launches, all four screens (Live Session, Knowledge
  Base, Session Log, Settings) are reachable via nav.
- `live-session.e2e.ts` — a "demo mode" run (fake ports + a recorded
  transcript fixture, no live mic/STT/network) shows a detected question,
  an answer card, and its sources.

## Prerequisites (on a machine with Rust)

1. **Rust toolchain** — https://rustup.rs
2. **Tauri 2 build prerequisites** for your OS — see
   https://v2.tauri.app/start/prerequisites/ (WebKitGTK + friends on Linux).
3. **tauri-driver**:
   ```sh
   cargo install tauri-driver
   ```
   On Linux you also need `WebKitWebDriver` on `PATH` (usually ships with the
   `webkit2gtk-driver` / `webkitgtk-driver` package from your distro).

## Running the suite

From `dogfood/interview-copilot/`:

```sh
pnpm install
pnpm tauri:build -- --debug     # builds src-tauri/target/debug/interview-copilot
pnpm test:e2e                   # preflight check, then wdio run e2e/wdio.conf.ts
```

`pnpm tauri:build` sets `TAURI_BUILD=1` so `vite.config.ts` switches the
SvelteKit adapter from `adapter-auto` to `adapter-static` (SPA fallback),
producing the `build/` directory `tauri.conf.json`'s `frontendDist` points
at. See the comment in `vite.config.ts` for why.

If you only want to confirm the environment is ready without running the
suite:

```sh
pnpm tsx e2e/preflight.ts
```

## Selector contract

Both specs assume the UI exposes stable `data-testid` attributes:

| testid | where |
| --- | --- |
| `nav-live`, `nav-kb`, `nav-log`, `nav-settings` | shell nav links |
| `screen-live`, `screen-kb`, `screen-log`, `screen-settings` | each route's root element |
| `start-demo-session` | a button/toggle on the Live Session screen that replays a recorded fixture through the fake ports instead of live adapters |
| `transcript`, `answer-card`, `source-list`, `source-item` | Live Session screen contents |
| `uncaught-error-banner` | app-wide error boundary, asserted absent |

If the shipped UI (owned by another agent this round — see `src/lib/ui`,
`src/routes`) uses different testids, update the two spec files to match;
don't invent brittle text/CSS selectors as a workaround.

## Why this can't run here

- No `cargo`/`rustc` → `Cargo.toml`/`src-tauri/` was never `cargo check`ed.
- No Rust → `tauri-driver` cannot be installed.
- No debug binary → there is nothing for `tauri-driver` to launch.
- No mic/GPU/Docker → even a successful e2e run couldn't exercise live
  transcription; that's why `live-session.e2e.ts` targets "demo mode"
  (fakes + fixtures) rather than a live STT path, matching how the rest of
  this project is verified (plan.md risk 1).

See `../docs/deferred-verification.md` for the full list of deferred checks
and their exact commands.
