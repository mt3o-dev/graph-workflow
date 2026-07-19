/**
 * Runs the shared StorePort contract against the real better-sqlite3 adapter.
 * Guarded with `describe.skipIf` — if the native build is unavailable on
 * this machine, this whole block (and only this block) is skipped; the
 * in-memory contract run (`src/test/fakes/in-memory-store.test.ts`) always
 * runs regardless, per plan.md Phase 4's native-build-failure mitigation.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { runStoreContract } from '../../../test/contracts/store.contract.js';
import { SqliteStoreAdapter } from './sqlite-store.adapter.js';

const require = createRequire(import.meta.url);

function detectNativeBuildUnavailable(): boolean {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const Database = require('better-sqlite3') as typeof import('better-sqlite3');
		const probe = new Database(':memory:');
		probe.close();
		return false;
	} catch {
		return true;
	}
}

const nativeBuildUnavailable = detectNativeBuildUnavailable();

// eslint-disable-next-line no-console
console.log(
	nativeBuildUnavailable
		? '[sqlite-store.adapter.test] better-sqlite3 native build UNAVAILABLE — sqlite contract SKIPPED (in-memory contract still ran).'
		: '[sqlite-store.adapter.test] better-sqlite3 native build available — sqlite contract RAN.'
);

describe.skipIf(nativeBuildUnavailable)('SqliteStoreAdapter', () => {
	it('native build is available', () => {
		expect(nativeBuildUnavailable).toBe(false);
	});

	runStoreContract({ createStore: () => new SqliteStoreAdapter(':memory:') });
});
