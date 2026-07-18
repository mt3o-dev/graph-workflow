/**
 * Tauri bridge — the ONLY place the frontend should reference `@tauri-apps/api`.
 *
 * Per tech-stack.md decision 1 and plan.md Phase 6, the Rust shell (src-tauri/)
 * is intentionally thin: it exposes exactly two commands
 * (`get_app_data_dir`, `spawn_sidecar_hint`; see src-tauri/src/lib.rs). This
 * module wraps both with types and guards every call behind `isTauri()` so
 * that running the app as a plain web page (`pnpm dev`, `pnpm build`, all
 * vitest/component tests) never touches `window.__TAURI_INTERNALS__` and
 * never throws for lack of it.
 *
 * Consumers (src/routes, src/lib/ui — owned by another agent this round)
 * should import from here, not from `@tauri-apps/api` directly, so the
 * "are we in Tauri or the browser" branch lives in exactly one place.
 */
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

/**
 * True when running inside the Tauri webview, false in a plain browser (dev
 * server, vitest+jsdom, a deployed web build). Tauri 2 injects this global
 * before any page script runs.
 */
export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Result type for bridge calls made outside Tauri: rather than throwing (and
 * forcing every caller into try/catch for what is an expected, common case
 * in web-dev-mode), calls resolve to a discriminated union so callers can
 * branch on `.ok` and keep pure-web dev mode fully functional.
 */
export type BridgeResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Returns the app's per-user data directory (see src-tauri/src/lib.rs
 * `get_app_data_dir`), where the TS side places its SQLite DB
 * (tech-stack.md decisions 4, 12) and config overlay files.
 *
 * Outside Tauri, resolves to `{ ok: false }` — callers (e.g. the config/DI
 * composition root) should fall back to a web-appropriate location or a
 * config-supplied path instead.
 */
export async function getAppDataDir(): Promise<BridgeResult<string>> {
	if (!isTauri()) {
		return { ok: false, reason: 'not running inside Tauri' };
	}
	try {
		const value = await tauriInvoke<string>('get_app_data_dir');
		return { ok: true, value };
	} catch (error) {
		return { ok: false, reason: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Calls the `spawn_sidecar_hint` stub (see src-tauri/src/lib.rs). This is
 * documented as the seam for a future Whisper-container-lifecycle feature —
 * explicitly a v1 non-goal (plan.md "App does not manage the Whisper Docker
 * container lifecycle") — so it currently always resolves to `{ ok: false }`
 * with the same message Rust returns, both inside and outside Tauri.
 */
export async function spawnSidecarHint(): Promise<BridgeResult<string>> {
	if (!isTauri()) {
		return { ok: false, reason: 'not running inside Tauri' };
	}
	try {
		const value = await tauriInvoke<string>('spawn_sidecar_hint');
		return { ok: true, value };
	} catch (error) {
		return { ok: false, reason: error instanceof Error ? error.message : String(error) };
	}
}
