/**
 * Runs the shared ClassificationStorePort contract against the real
 * better-sqlite3 adapter, plus a dedicated SQLite-only test proving FK
 * enforcement is genuinely ON (R2 plan-review gate) — this cannot live in
 * the shared contract because the in-memory fake has no real FK constraints
 * to violate. Guarded with `describe.skipIf`, same as slice-1's
 * sqlite-store.adapter.test.ts, so a native-build failure only skips this
 * block; the in-memory contract run always runs regardless (R1).
 *
 * Uses a real temp FILE (never `:memory:`) per R2: `:memory:` would be a
 * separate database per connection, so the FK from `assignments` to
 * `transactions(content_hash)` (owned by the primary `SqliteStoreAdapter`
 * connection in production) couldn't be exercised at all.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runClassificationStoreContract } from '../../../test/contracts/classification-store.contract.js';
import { SqliteStoreAdapter } from './sqlite-store.adapter.js';
import { SqliteClassificationStoreAdapter } from './sqlite-classification-store.adapter.js';

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
		? '[sqlite-classification-store.adapter.test] better-sqlite3 native build UNAVAILABLE — sqlite contract SKIPPED (in-memory contract still ran).'
		: '[sqlite-classification-store.adapter.test] better-sqlite3 native build available — sqlite contract RAN.'
);

const tempDirs: string[] = [];

function tempDbFile(): string {
	const dir = mkdtempSync(join(tmpdir(), 'coffer-classification-'));
	tempDirs.push(dir);
	return join(dir, 'coffer.db');
}

describe.skipIf(nativeBuildUnavailable)('SqliteClassificationStoreAdapter', () => {
	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	it('native build is available', () => {
		expect(nativeBuildUnavailable).toBe(false);
	});

	runClassificationStoreContract({
		createStore: () => new SqliteClassificationStoreAdapter(tempDbFile()),
		// R2: assignments.tx_content_hash genuinely FK-references
		// transactions(content_hash) on this adapter, so the shared contract's
		// assignment tests need real rows to reference — seed them via a
		// paired SqliteStoreAdapter on the SAME db file (adapter.db.name is
		// the resolved path better-sqlite3 opened).
		seedTransactions: async (store, contentHashes) => {
			const dbPath = (store as SqliteClassificationStoreAdapter).db.name;
			const primaryStore = new SqliteStoreAdapter(dbPath);
			await primaryStore.migrate();
			await primaryStore.createBatch({
				id: 'contract-seed',
				importedAt: new Date().toISOString(),
				parserId: 'seed',
				sourceLabel: 'contract-seed'
			});
			await primaryStore.save(
				'contract-seed',
				contentHashes.map((contentHash) => ({
					bookingDate: '2026-01-01',
					valueDate: '2026-01-01',
					amount: { minor: 100n, currency: 'PLN' },
					direction: 'out' as const,
					counterparty: 'ACME',
					description: 'Seed row',
					sourceAccount: 'PL00',
					importBatchId: 'contract-seed',
					contentHash
				}))
			);
			await primaryStore.close();
		}
	});

	it('sets foreign_keys and busy_timeout pragmas on connect (R2)', () => {
		const adapter = new SqliteClassificationStoreAdapter(tempDbFile());
		expect(adapter.db.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(adapter.db.pragma('busy_timeout', { simple: true })).toBe(5000);
		adapter.db.close();
	});

	it('FK enforcement is genuinely ON: inserting an assignment for a missing tx hash throws', async () => {
		const dbPath = tempDbFile();

		// Same configured db file as production: the primary store owns
		// migration 001 (transactions), the classification store owns 002
		// (groups/rules/assignments) — both apply against the same file.
		const store = new SqliteStoreAdapter(dbPath);
		await store.migrate();
		const classificationStore = new SqliteClassificationStoreAdapter(dbPath);
		await classificationStore.migrate();

		await classificationStore.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });

		expect(() =>
			classificationStore.db
				.prepare(
					`INSERT INTO assignments (tx_content_hash, group_id, source, created_at)
					 VALUES (?, ?, ?, ?)`
				)
				.run('no-such-tx-hash', 'g1', 'rule', new Date().toISOString())
		).toThrow(/FOREIGN KEY/i);

		await store.close();
		await classificationStore.close();
	});

	it('a valid assignment (matching tx hash) inserts cleanly once the tx exists', async () => {
		const dbPath = tempDbFile();

		const store = new SqliteStoreAdapter(dbPath);
		await store.migrate();
		await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's' });
		await store.save('b1', [
			{
				bookingDate: '2026-01-01',
				valueDate: '2026-01-01',
				amount: { minor: 100n, currency: 'PLN' },
				direction: 'out',
				counterparty: 'ACME',
				description: 'Test',
				sourceAccount: 'PL00',
				importBatchId: 'b1',
				contentHash: 'real-tx-hash'
			}
		]);

		const classificationStore = new SqliteClassificationStoreAdapter(dbPath);
		await classificationStore.migrate();
		await classificationStore.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });

		expect(() =>
			classificationStore.db
				.prepare(
					`INSERT INTO assignments (tx_content_hash, group_id, source, created_at)
					 VALUES (?, ?, ?, ?)`
				)
				.run('real-tx-hash', 'g1', 'rule', new Date().toISOString())
		).not.toThrow();

		await store.close();
		await classificationStore.close();
	});
});
