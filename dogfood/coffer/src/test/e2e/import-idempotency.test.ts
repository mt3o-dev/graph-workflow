/**
 * Idempotency e2e (Phase 7 headline verification, [dec:5]) — proves the
 * whole vertical slice through the REAL composition root
 * (`src/lib/server/container.ts`): parser registry -> pipeline -> StorePort.
 *
 * Runs against a REAL sqlite temp-file store when the better-sqlite3 native
 * build is available on this machine; falls back to the `InMemoryStoreAdapter`
 * fake otherwise (same pattern as `sqlite-store.adapter.test.ts`), so the
 * assertion always runs regardless of the native build's availability
 * (plan.md Phase 4 risk mitigation, carried into Phase 7).
 *
 * For every committed fixture (tabular .txt, .csv, .ofx): import once and
 * assert N transactions inserted, then re-import the EXACT same fixture and
 * assert 0 inserted / N duplicates, with the store's total row count
 * unchanged across the re-import.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigPort } from '../../lib/ports/config.port.js';
import type { StorePort } from '../../lib/ports/store.port.js';
import { Container } from '../../lib/server/container.js';
import { SqliteStoreAdapter } from '../../lib/adapters/store/sqlite-store.adapter.js';
import { InMemoryStoreAdapter } from '../fakes/in-memory-store.js';

const require = createRequire(import.meta.url);

function nativeSqliteAvailable(): boolean {
	try {
		const Database = require('better-sqlite3') as typeof import('better-sqlite3');
		const probe = new Database(':memory:');
		probe.close();
		return true;
	} catch {
		return false;
	}
}

const FIXTURES_DIR = join(__dirname, '../fixtures/statements');

/** Minimal ConfigPort fake: enables all three parsers, in registry priority order. */
const testConfig: ConfigPort = {
	get<T>(path: string, defaultValue?: T): T {
		if (path === 'import.enabledParsers') {
			return ['generic-tabular-pdf', 'csv', 'ofx'] as unknown as T;
		}
		if (defaultValue !== undefined) return defaultValue;
		throw new Error(`testConfig: no value for "${path}"`);
	},
	getAll() {
		throw new Error('testConfig.getAll: not implemented for this test fake');
	}
};

interface Fixture {
	readonly name: string;
	readonly file: string;
	/** Expected distinct-content transaction count from a single import. */
	readonly expectedInserted: number;
}

const FIXTURES: Fixture[] = [
	{ name: 'generic-tabular-pdf: debit-credit', file: 'debit-credit.txt', expectedInserted: 3 },
	{ name: 'generic-tabular-pdf: signed-amount', file: 'signed-amount.txt', expectedInserted: 3 },
	{ name: 'csv: comma-dot', file: 'sample-comma-dot.csv', expectedInserted: 4 },
	{ name: 'csv: semicolon-comma', file: 'sample-semicolon-comma.csv', expectedInserted: 4 },
	{ name: 'ofx: sample', file: 'sample.ofx', expectedInserted: 4 }
];

const nativeAvailable = nativeSqliteAvailable();
let tmpDir: string | undefined;

if (nativeAvailable) {
	beforeAll(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'coffer-import-e2e-'));
	});
	afterAll(() => {
		if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
	});
}

// eslint-disable-next-line no-console
console.log(
	nativeAvailable
		? '[import-idempotency.test] better-sqlite3 native build AVAILABLE — e2e ran against a real sqlite temp-file store.'
		: '[import-idempotency.test] better-sqlite3 native build UNAVAILABLE — e2e ran against the InMemoryStoreAdapter fallback.'
);

describe(`import idempotency e2e (store: ${nativeAvailable ? 'sqlite temp-file' : 'in-memory fallback'})`, () => {
	let store: StorePort;
	let container: Container;

	afterEach(async () => {
		await container.close();
	});

	function makeStore(fixtureName: string): StorePort {
		if (nativeAvailable && tmpDir) {
			const dbPath = join(tmpDir, `${fixtureName.replace(/[^a-z0-9-]/gi, '_')}.db`);
			return new SqliteStoreAdapter(dbPath);
		}
		return new InMemoryStoreAdapter();
	}

	for (const fixture of FIXTURES) {
		it(`${fixture.name}: first import inserts ${fixture.expectedInserted}, re-import inserts 0 / dedups ${fixture.expectedInserted}`, async () => {
			store = makeStore(fixture.file);
			container = new Container(testConfig, store);
			await container.init();

			const payload = readFileSync(join(FIXTURES_DIR, fixture.file), 'utf-8');
			const ctx = { sourceAccount: 'PL00-E2E-TEST', defaultCurrency: 'PLN' };

			const first = await container.importStatement({ payload, ctx, sourceLabel: fixture.file });
			expect(first.inserted).toBe(fixture.expectedInserted);
			expect(first.duplicates).toBe(0);
			const countAfterFirst = await store.count();
			expect(countAfterFirst).toBe(fixture.expectedInserted);

			const second = await container.importStatement({ payload, ctx, sourceLabel: fixture.file });
			expect(second.inserted).toBe(0);
			expect(second.duplicates).toBe(fixture.expectedInserted);
			const countAfterSecond = await store.count();
			expect(countAfterSecond).toBe(countAfterFirst);
		});
	}
});
