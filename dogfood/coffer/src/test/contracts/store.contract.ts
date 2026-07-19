/**
 * Shared StorePort contract (Phase 4, dec:3). One assertion suite, run
 * against every StorePort implementation (the in-memory fake, always; the
 * SQLite adapter, when the native build is available) so both stay
 * behaviorally identical — this is what lets Phase 7's pipeline tests trust
 * either adapter interchangeably.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '../../lib/core/model/transaction.js';
import type { StorePort } from '../../lib/ports/store.port.js';

export interface StoreContractOptions {
	/** Produce a fresh, unmigrated store instance for each test. */
	createStore: () => StorePort | Promise<StorePort>;
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: 12345n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'ACME',
		description: 'Test transaction',
		sourceAccount: 'PL00-TEST',
		importBatchId: 'unused-stamped-by-caller',
		contentHash: 'default-hash',
		...overrides
	};
}

/** Register the shared StorePort contract as a `describe` block. Call inside your own `describe(...)`. */
export function runStoreContract(options: StoreContractOptions): void {
	describe('StorePort contract', () => {
		let store: StorePort;

		beforeEach(async () => {
			store = await options.createStore();
			await store.migrate();
		});

		afterEach(async () => {
			await store.close();
		});

		it('migrate() is idempotent', async () => {
			await store.migrate();
			await store.migrate();
			expect(await store.count()).toBe(0);
		});

		it('createBatch() returns the batch as given', async () => {
			const batch = await store.createBatch({
				id: 'b1',
				importedAt: '2026-01-01T00:00:00.000Z',
				parserId: 'csv',
				sourceLabel: 'statement.csv'
			});
			expect(batch).toEqual({
				id: 'b1',
				importedAt: '2026-01-01T00:00:00.000Z',
				parserId: 'csv',
				sourceLabel: 'statement.csv'
			});
		});

		it('save() inserts N new transactions and reports 0 duplicates', async () => {
			await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's' });
			const txns = [
				makeTransaction({ contentHash: 'h1', importBatchId: 'b1' }),
				makeTransaction({ contentHash: 'h2', importBatchId: 'b1' }),
				makeTransaction({ contentHash: 'h3', importBatchId: 'b1' })
			];

			const result = await store.save('b1', txns);

			expect(result).toEqual({ batchId: 'b1', inserted: 3, duplicates: 0 });
			expect(await store.count()).toBe(3);
		});

		it('re-saving the same transactions reports 0 inserted / N duplicates', async () => {
			await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's' });
			const txns = [
				makeTransaction({ contentHash: 'h1', importBatchId: 'b1' }),
				makeTransaction({ contentHash: 'h2', importBatchId: 'b1' })
			];
			await store.save('b1', txns);

			const second = await store.save('b1', txns);

			expect(second).toEqual({ batchId: 'b1', inserted: 0, duplicates: 2 });
			expect(await store.count()).toBe(2);
		});

		it('count()/has()/all() report correctly', async () => {
			await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's' });
			await store.save('b1', [
				makeTransaction({ contentHash: 'h1', importBatchId: 'b1' }),
				makeTransaction({ contentHash: 'h2', importBatchId: 'b1' })
			]);

			expect(await store.count()).toBe(2);
			expect(await store.has('h1')).toBe(true);
			expect(await store.has('does-not-exist')).toBe(false);

			const all = await store.all();
			expect(all).toHaveLength(2);
			expect(all.map((t) => t.contentHash).sort()).toEqual(['h1', 'h2']);
		});

		it('bigint amounts round-trip exactly, including beyond MAX_SAFE_INTEGER and negative values', async () => {
			await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's' });
			const huge = 9_007_199_254_740_993n; // Number.MAX_SAFE_INTEGER + 2 — unsafe as a JS number
			const negative = -huge;

			await store.save('b1', [
				makeTransaction({ contentHash: 'big-pos', importBatchId: 'b1', amount: { minor: huge, currency: 'JPY' } }),
				makeTransaction({
					contentHash: 'big-neg',
					importBatchId: 'b1',
					amount: { minor: negative, currency: 'JPY' }
				})
			]);

			const all = await store.all();
			const pos = all.find((t) => t.contentHash === 'big-pos');
			const neg = all.find((t) => t.contentHash === 'big-neg');

			expect(typeof pos?.amount.minor).toBe('bigint');
			expect(pos?.amount.minor).toBe(huge);
			expect(neg?.amount.minor).toBe(negative);
		});

		it('dedups across batches — the same contentHash in a second batch is a duplicate', async () => {
			await store.createBatch({ id: 'b1', importedAt: 'now', parserId: 'csv', sourceLabel: 's1' });
			await store.createBatch({ id: 'b2', importedAt: 'now', parserId: 'csv', sourceLabel: 's2' });

			await store.save('b1', [makeTransaction({ contentHash: 'cross-batch', importBatchId: 'b1' })]);
			const result = await store.save('b2', [makeTransaction({ contentHash: 'cross-batch', importBatchId: 'b2' })]);

			expect(result).toEqual({ batchId: 'b2', inserted: 0, duplicates: 1 });
			expect(await store.count()).toBe(1);
		});
	});
}
