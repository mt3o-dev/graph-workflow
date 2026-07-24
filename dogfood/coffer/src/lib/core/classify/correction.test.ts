import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryClassificationStoreAdapter } from '../../../test/fakes/in-memory-classification-store.js';
import type { Transaction } from '../model/transaction.js';
import { recordManualCorrection, promoteCorrectionToRule } from './correction.js';
import { runClassification } from './run.js';

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

describe('correction -> rule promotion flow (P4)', () => {
	let store: InMemoryClassificationStoreAdapter;

	beforeEach(async () => {
		store = new InMemoryClassificationStoreAdapter();
		await store.migrate();
		await store.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
	});

	it('recordManualCorrection persists a manual assignment for every corrected group', async () => {
		const tx = makeTx();
		await store.upsertGroup({ id: 'g2', name: 'Recurring', parentId: null, kind: 'tag' });

		await recordManualCorrection(tx, ['g1', 'g2'], store);

		const rows = await store.assignmentsFor('tx1');
		expect(rows.map((r) => r.groupId).sort()).toEqual(['g1', 'g2']);
		expect(rows.every((r) => r.source === 'manual')).toBe(true);
	});

	it('promoting a correction produces a rule whose re-eval reproduces the correction on OTHER matching transactions', async () => {
		const corrected = makeTx({ contentHash: 'tx-corrected' });
		const other = makeTx({ contentHash: 'tx-other-same-counterparty' });

		await recordManualCorrection(corrected, ['g1'], store);
		const rule = await promoteCorrectionToRule(corrected, ['g1'], { id: 'r-promoted', order: 0 }, store);

		expect((await store.listRules()).map((r) => r.id)).toEqual(['r-promoted']);

		await runClassification([corrected, other], [rule], store);

		expect(await store.assignmentsFor('tx-other-same-counterparty')).toEqual([
			{ txContentHash: 'tx-other-same-counterparty', groupId: 'g1', source: 'rule', ruleId: 'r-promoted' }
		]);
	});

	it('re-eval after promotion never clobbers the original manual correction (stays source: manual)', async () => {
		const tx = makeTx();
		await recordManualCorrection(tx, ['g1'], store);
		const rule = await promoteCorrectionToRule(tx, ['g1'], { id: 'r-promoted', order: 0 }, store);

		await runClassification([tx], [rule], store);

		expect(await store.assignmentsFor('tx1')).toEqual([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);
	});

	it('re-running classify after promotion is idempotent (no duplicate rows) and does not disturb unrelated manual work', async () => {
		const tx = makeTx();
		const unrelated = makeTx({ contentHash: 'tx-unrelated', counterparty: 'OTHER CO' });
		await store.upsertGroup({ id: 'g2', name: 'Rent', parentId: null, kind: 'group' });
		await recordManualCorrection(unrelated, ['g2'], store);

		await recordManualCorrection(tx, ['g1'], store);
		const rule = await promoteCorrectionToRule(tx, ['g1'], { id: 'r-promoted', order: 0 }, store);

		await runClassification([tx, unrelated], [rule], store);
		await runClassification([tx, unrelated], [rule], store);

		expect(await store.assignmentsFor('tx1')).toEqual([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);
		expect(await store.assignmentsFor('tx-unrelated')).toEqual([
			{ txContentHash: 'tx-unrelated', groupId: 'g2', source: 'manual' }
		]);
	});
});
