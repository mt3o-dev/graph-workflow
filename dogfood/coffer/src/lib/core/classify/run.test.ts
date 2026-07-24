import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryClassificationStoreAdapter } from '../../../test/fakes/in-memory-classification-store.js';
import type { Transaction } from '../model/transaction.js';
import type { Rule } from '../model/rule.js';
import { runClassification, reviewQueue } from './run.js';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: -1000n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'ACME',
		description: 'Groceries at ACME',
		sourceAccount: 'PL00',
		importBatchId: 'b1',
		contentHash: 'tx1',
		...overrides
	};
}

function counterpartyRule(overrides: Partial<Rule> = {}): Rule {
	return {
		id: 'r1',
		order: 0,
		predicate: { kind: 'field', field: 'counterparty', op: 'equals', value: 'ACME' },
		assign: ['g1'],
		...overrides
	};
}

describe('runClassification', () => {
	let store: InMemoryClassificationStoreAdapter;

	beforeEach(async () => {
		store = new InMemoryClassificationStoreAdapter();
		await store.migrate();
		await store.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
	});

	it('persists rule-sourced assignments from the pure engine', async () => {
		const tx = makeTx();
		const result = await runClassification([tx], [counterpartyRule()], store);

		expect(result.assignmentsProduced).toBe(1);
		expect(await store.assignmentsFor('tx1')).toEqual([
			{ txContentHash: 'tx1', groupId: 'g1', source: 'rule', ruleId: 'r1' }
		]);
	});

	it('is idempotent: re-running against the same txns/rules produces no duplicate rows', async () => {
		const tx = makeTx();
		await runClassification([tx], [counterpartyRule()], store);
		await runClassification([tx], [counterpartyRule()], store);

		expect(await store.assignmentsFor('tx1')).toHaveLength(1);
	});

	it('never overwrites a prior manual assignment for the same (tx, group) pair (sticky-manual, R4)', async () => {
		const tx = makeTx();
		await store.saveAssignments([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);

		await runClassification([tx], [counterpartyRule()], store);

		expect(await store.assignmentsFor('tx1')).toEqual([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);
	});

	it('a transaction matched by zero rules stays unmatched after a run', async () => {
		const tx = makeTx({ contentHash: 'tx-unmatched', counterparty: 'SOMEONE ELSE' });

		await runClassification([tx], [counterpartyRule()], store);

		expect(await store.unmatched(['tx-unmatched'])).toEqual(['tx-unmatched']);
	});
});

describe('reviewQueue', () => {
	let store: InMemoryClassificationStoreAdapter;

	beforeEach(async () => {
		store = new InMemoryClassificationStoreAdapter();
		await store.migrate();
		await store.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
	});

	it('returns exactly the transactions with zero assignments, preserving input order', async () => {
		const matched = makeTx({ contentHash: 'tx-matched' });
		const unmatched1 = makeTx({ contentHash: 'tx-unmatched-1', counterparty: 'OTHER' });
		const unmatched2 = makeTx({ contentHash: 'tx-unmatched-2', counterparty: 'OTHER' });
		await store.saveAssignments([{ txContentHash: 'tx-matched', groupId: 'g1', source: 'manual' }]);

		const queue = await reviewQueue([unmatched1, matched, unmatched2], store);

		expect(queue.map((t) => t.contentHash)).toEqual(['tx-unmatched-1', 'tx-unmatched-2']);
	});

	it('a manual correction removes a transaction from the review queue', async () => {
		const tx = makeTx();
		expect((await reviewQueue([tx], store)).map((t) => t.contentHash)).toEqual(['tx1']);

		await store.saveAssignments([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);

		expect(await reviewQueue([tx], store)).toEqual([]);
	});
});
