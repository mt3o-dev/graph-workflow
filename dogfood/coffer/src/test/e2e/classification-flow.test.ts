/**
 * Classification e2e (P6 headline verification, [dec:a49130e3], [dec:efd6891c],
 * [dec:65e4485f]) — proves the whole slice-2 vertical through the REAL
 * composition root (`src/lib/server/container.ts`) against a REAL sqlite
 * temp-file db (both `SqliteStoreAdapter` and `SqliteClassificationStoreAdapter`
 * sharing one file, per [dec:a49130e3]): import fixtures -> define
 * groups/rules -> classify -> assert unmatched -> manual-correct -> promote
 * -> re-classify reproduces; manual stays sticky.
 *
 * Falls back to the in-memory fakes when the better-sqlite3 native build is
 * unavailable (same pattern as `import-idempotency.test.ts`), so the
 * assertion always runs.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigPort } from '../../lib/ports/config.port.js';
import type { StorePort } from '../../lib/ports/store.port.js';
import type { ClassificationStorePort } from '../../lib/ports/classification-store.port.js';
import { Container } from '../../lib/server/container.js';
import { SqliteStoreAdapter } from '../../lib/adapters/store/sqlite-store.adapter.js';
import { SqliteClassificationStoreAdapter } from '../../lib/adapters/store/sqlite-classification-store.adapter.js';
import { InMemoryStoreAdapter } from '../fakes/in-memory-store.js';
import { InMemoryClassificationStoreAdapter } from '../fakes/in-memory-classification-store.js';

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

const nativeAvailable = nativeSqliteAvailable();

// eslint-disable-next-line no-console
console.log(
	nativeAvailable
		? '[classification-flow.test] better-sqlite3 native build AVAILABLE — e2e ran against a real sqlite temp-file store.'
		: '[classification-flow.test] better-sqlite3 native build UNAVAILABLE — e2e ran against the in-memory fallbacks.'
);

const FIXTURES_DIR = join(__dirname, '../fixtures/statements');

/** Minimal ConfigPort fake: default parser set, heuristic assist, disabled. */
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

let tmpDir: string | undefined;

if (nativeAvailable) {
	beforeAll(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'coffer-classification-e2e-'));
	});
	afterAll(() => {
		if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
	});
}

function makeStores(): { store: StorePort; classificationStore: ClassificationStorePort } {
	if (nativeAvailable && tmpDir) {
		const dbPath = join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
		return { store: new SqliteStoreAdapter(dbPath), classificationStore: new SqliteClassificationStoreAdapter(dbPath) };
	}
	return { store: new InMemoryStoreAdapter(), classificationStore: new InMemoryClassificationStoreAdapter() };
}

describe(`classification e2e (store: ${nativeAvailable ? 'sqlite temp-file' : 'in-memory fallback'})`, () => {
	let container: Container;

	afterEach(async () => {
		await container.close();
	});

	it('import -> classify -> review queue -> manual correct -> promote -> re-classify reproduces, manual stays sticky', async () => {
		const { store, classificationStore } = makeStores();
		container = new Container(testConfig, store, classificationStore);
		await container.init();

		// Import: fixture has counterparties Supermart (x2), Bank, Employer Inc.
		const payload = readFileSync(join(FIXTURES_DIR, 'sample-comma-dot.csv'), 'utf-8');
		const ctx = { sourceAccount: 'PL00-CLASSIFY-E2E', defaultCurrency: 'USD' };
		const saveResult = await container.importStatement({ payload, ctx, sourceLabel: 'sample-comma-dot.csv' });
		expect(saveResult.inserted).toBe(4);

		await container.classificationStore.upsertGroup({ id: 'groceries', name: 'Groceries', parentId: null, kind: 'group' });
		await container.classificationStore.upsertGroup({ id: 'fees', name: 'Fees', parentId: null, kind: 'group' });
		await container.classificationStore.upsertRule({
			id: 'r-supermart',
			order: 0,
			predicate: { kind: 'field', field: 'counterparty', op: 'equals', value: 'Supermart' },
			assign: ['groceries']
		});

		// First classify: Supermart's two txns match the rule; Bank and
		// Employer Inc match nothing -> both land in the review queue.
		const firstRun = await container.classify();
		expect(firstRun.assignmentsProduced).toBe(2);

		const queueAfterFirstRun = await container.reviewQueue();
		expect(queueAfterFirstRun.map((t) => t.counterparty).sort()).toEqual(['Bank', 'Employer Inc']);

		// Manual correction: the "Zero fee" Bank transaction gets corrected to Fees.
		const bankTx = queueAfterFirstRun.find((t) => t.counterparty === 'Bank');
		if (!bankTx) throw new Error('test setup: expected a Bank transaction in the review queue');
		await container.assign(bankTx, ['fees']);

		expect((await container.reviewQueue()).map((t) => t.counterparty).sort()).toEqual(['Employer Inc']);

		// Promote the correction to a rule.
		const promoted = await container.promoteToRule(bankTx, ['fees'], { id: 'r-bank-promoted' });
		expect(promoted.predicate).toEqual({ kind: 'field', field: 'counterparty', op: 'equals', value: 'Bank' });

		const rulesAfterPromotion = await container.classificationStore.listRules();
		expect(rulesAfterPromotion.map((r) => r.id).sort()).toEqual(['r-bank-promoted', 'r-supermart']);

		// Re-classify: the promoted rule reproduces the correction (still
		// 'manual', not overwritten to 'rule'), and no unrelated rows changed.
		const secondRun = await container.classify();
		expect(secondRun.assignmentsProduced).toBe(3); // 2 Supermart + 1 Bank (from the newly-appended rule)

		const bankAssignments = await container.classificationStore.assignmentsFor(bankTx.contentHash);
		expect(bankAssignments).toEqual([{ txContentHash: bankTx.contentHash, groupId: 'fees', source: 'manual' }]);

		// Re-classifying again is idempotent: no duplicate rows anywhere.
		await container.classify();
		expect(await container.classificationStore.assignmentsFor(bankTx.contentHash)).toHaveLength(1);

		// Employer Inc still unmatched — nothing over-eagerly classified it.
		expect((await container.reviewQueue()).map((t) => t.counterparty)).toEqual(['Employer Inc']);
	});

	it('suggest() returns [] while assist is disabled by default (config default OFF, dec:7)', async () => {
		const { store, classificationStore } = makeStores();
		container = new Container(testConfig, store, classificationStore);
		await container.init();

		const payload = readFileSync(join(FIXTURES_DIR, 'sample-comma-dot.csv'), 'utf-8');
		await container.importStatement({
			payload,
			ctx: { sourceAccount: 'PL00-ASSIST-E2E', defaultCurrency: 'USD' },
			sourceLabel: 'sample-comma-dot.csv'
		});
		const [tx] = await container.store.all();

		expect(await container.suggest(tx)).toEqual([]);
	});
});
