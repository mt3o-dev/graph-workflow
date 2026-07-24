import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../core/model/transaction.js';
import type { AssistContext } from '../../ports/assist.port.js';
import { HeuristicAssistAdapter } from './heuristic-assist.adapter.js';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: 1000n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'Acme Corp',
		description: 'Grocery run at Acme',
		sourceAccount: 'PL00-CHECKING',
		importBatchId: 'b1',
		contentHash: 'h1',
		...overrides
	};
}

describe('HeuristicAssistAdapter: ranking', () => {
	it('ranks the group whose historical descriptions match the target tx first, with sane confidence', async () => {
		const adapter = new HeuristicAssistAdapter();
		const target = makeTx({ description: 'GROCERY STORE PURCHASE', counterparty: 'Fresh Mart' });

		const ctx: AssistContext = {
			classified: [
				{ tx: makeTx({ description: 'Grocery store purchase', contentHash: 'a' }), groupIds: ['groceries'] },
				{ tx: makeTx({ description: 'grocery store purchase again', contentHash: 'b' }), groupIds: ['groceries'] },
				{ tx: makeTx({ description: 'Netflix subscription', contentHash: 'c' }), groupIds: ['entertainment'] }
			]
		};

		const suggestions = await adapter.suggest(target, ctx);

		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions[0].groupId).toBe('groceries');
		expect(suggestions[0].confidence).toBeGreaterThan(0);
		expect(suggestions[0].confidence).toBeLessThanOrEqual(1);
		expect(suggestions[0].reason.length).toBeGreaterThan(0);

		// entertainment (no token overlap) must not outrank groceries, and
		// every confidence must stay within the documented 0..1 range.
		for (const suggestion of suggestions) {
			expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
			expect(suggestion.confidence).toBeLessThanOrEqual(1);
		}
		const entertainment = suggestions.find((s) => s.groupId === 'entertainment');
		expect(entertainment).toBeUndefined();
	});

	it('breaks ties toward the group seen more frequently in the corpus', async () => {
		const adapter = new HeuristicAssistAdapter();
		const target = makeTx({ description: 'coffee shop', contentHash: 'target' });

		const ctx: AssistContext = {
			classified: [
				{ tx: makeTx({ description: 'coffee shop', contentHash: 'a' }), groupIds: ['dining'] },
				{ tx: makeTx({ description: 'coffee shop', contentHash: 'b' }), groupIds: ['dining'] },
				{ tx: makeTx({ description: 'coffee shop', contentHash: 'c' }), groupIds: ['dining'] },
				{ tx: makeTx({ description: 'coffee shop', contentHash: 'd' }), groupIds: ['misc'] }
			]
		};

		const suggestions = await adapter.suggest(target, ctx);

		expect(suggestions[0].groupId).toBe('dining');
	});
});

describe('HeuristicAssistAdapter: empty corpus', () => {
	it('returns no suggestions when the corpus is empty', async () => {
		const adapter = new HeuristicAssistAdapter();
		const suggestions = await adapter.suggest(makeTx(), { classified: [] });
		expect(suggestions).toEqual([]);
	});

	it('returns no suggestions when the target description tokenizes to nothing', async () => {
		const adapter = new HeuristicAssistAdapter();
		const ctx: AssistContext = {
			classified: [{ tx: makeTx({ contentHash: 'a' }), groupIds: ['groceries'] }]
		};
		const suggestions = await adapter.suggest(makeTx({ description: '   ' }), ctx);
		expect(suggestions).toEqual([]);
	});
});

describe('assist-never-commits invariant', () => {
	it('the heuristic adapter source imports no store port and no adapters directory', async () => {
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const source = readFileSync(fileURLToPath(new URL('./heuristic-assist.adapter.ts', import.meta.url)), 'utf-8');

		expect(source).not.toMatch(/store\.port/);
		expect(source).not.toMatch(/classification-store/);
		expect(source).not.toMatch(/from ['"](\.\.\/)+adapters\//);
		expect(source).not.toMatch(/node:(fs|net|http|https|child_process)/);
	});

	it("AssistPort.suggest is the adapter's only public method (no save/write/commit APIs)", () => {
		const proto = Object.getPrototypeOf(new HeuristicAssistAdapter());
		const methodNames = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
		expect(methodNames).toEqual(['suggest']);
	});
});
