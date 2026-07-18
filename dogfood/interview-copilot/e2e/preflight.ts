#!/usr/bin/env -S tsx
/**
 * E2e preflight check.
 *
 * This machine has Node + pnpm only — no Rust/cargo toolchain, no Docker, no
 * GPU (see docs/deferred-verification.md). Tauri e2e tests need:
 *   1. `tauri-driver` on PATH (installed via `cargo install tauri-driver`),
 *   2. a debug Tauri binary built via `pnpm tauri:build -- --debug`
 *      (or `pnpm tauri build --debug` directly).
 *
 * Neither can exist here, so this script's job is to fail FAST and CLEARLY —
 * "skip, here's exactly why and what to run instead" — rather than let wdio
 * hang trying to connect to a driver/binary that doesn't exist.
 *
 * `pnpm test:e2e` chains this with `&&` before `wdio run`, so a missing
 * precondition exits 1 here — deliberately, to short-circuit the chain
 * before wdio ever tries to attach — while printing a message that makes
 * clear this is an expected, documented gap on this machine (see
 * docs/deferred-verification.md), not a real test failure. Neither
 * `pnpm typecheck`, `pnpm test`, nor `pnpm build` depend on this script
 * (plan.md Phase 6 risk 3), so it never blocks the required green pipeline.
 *
 * See e2e/README-e2e.md for the exact commands to run this for real on a
 * machine with the Rust toolchain.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

function commandExists(cmd: string): boolean {
	try {
		execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function findDebugBinary(): string | undefined {
	const root = join(import.meta.dirname, '..');
	const candidates = [
		join(root, 'src-tauri', 'target', 'debug', 'interview-copilot'),
		join(root, 'src-tauri', 'target', 'debug', 'interview-copilot.exe')
	];
	return candidates.find((path) => existsSync(path));
}

const missing: string[] = [];

if (!commandExists('tauri-driver')) {
	missing.push(
		'tauri-driver not found on PATH — install with `cargo install tauri-driver` (requires the Rust toolchain).'
	);
}

const debugBinary = findDebugBinary();
if (!debugBinary) {
	missing.push(
		'No debug Tauri binary at src-tauri/target/debug/interview-copilot(.exe) — build one with ' +
			'`pnpm tauri:build -- --debug` (requires the Rust toolchain; see e2e/README-e2e.md).'
	);
}

if (missing.length > 0) {
	console.log('='.repeat(72));
	console.log('e2e preflight: SKIPPING — this environment cannot run Tauri e2e tests.');
	console.log('='.repeat(72));
	for (const reason of missing) {
		console.log(`  - ${reason}`);
	}
	console.log('');
	console.log('This is expected on the Node/pnpm-only build machine used for the rest');
	console.log('of this project (see docs/deferred-verification.md). To actually run the');
	console.log('e2e suite, follow e2e/README-e2e.md on a machine with Rust installed:');
	console.log('  1. cargo install tauri-driver');
	console.log('  2. pnpm tauri:build -- --debug');
	console.log('  3. pnpm test:e2e');
	console.log('='.repeat(72));
	// Exit 1 to short-circuit `pnpm test:e2e`'s `&&` chain before wdio tries
	// (and hangs) attaching to a nonexistent driver/binary. This is a "skip",
	// not a real failure — see the message above and docs/deferred-verification.md.
	process.exit(1);
}

console.log('e2e preflight: OK — tauri-driver found, debug binary at', debugBinary);
