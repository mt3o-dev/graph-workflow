import { describe, expect, it } from 'vitest';
import { normalizeTransaction } from './transaction';
import { money, type ParsedRow } from '../model/transaction';

const row: ParsedRow = {
	bookingDate: '2026-07-19',
	valueDate: '2026-07-20',
	amount: money(-4599, 'PLN'),
	counterparty: 'Grocery Co',
	description: 'Grocery  Store   Purchase',
	sourceAccount: 'PL61 1090 1014 0000 0712 1981 2874'
};

describe('normalizeTransaction', () => {
	it('derives direction from the amount sign', () => {
		const tx = normalizeTransaction(row, 'batch-1');
		expect(tx.direction).toBe('out');
	});

	it('derives "in" for a positive amount', () => {
		const incoming: ParsedRow = { ...row, amount: money(4599, 'PLN') };
		expect(normalizeTransaction(incoming, 'batch-1').direction).toBe('in');
	});

	it('stamps the import batch id', () => {
		const tx = normalizeTransaction(row, 'batch-42');
		expect(tx.importBatchId).toBe('batch-42');
	});

	it('preserves the raw description unmodified for display', () => {
		const tx = normalizeTransaction(row, 'batch-1');
		expect(tx.description).toBe('Grocery  Store   Purchase');
	});

	it('computes a content hash', () => {
		const tx = normalizeTransaction(row, 'batch-1');
		expect(tx.contentHash).toMatch(/^[0-9a-f]{16}$/);
	});

	it('produces the same hash for rows differing only in description whitespace/case', () => {
		const a = normalizeTransaction(row, 'batch-1');
		const b = normalizeTransaction(
			{ ...row, description: 'GROCERY STORE PURCHASE' },
			'batch-1'
		);
		expect(a.contentHash).toBe(b.contentHash);
	});

	it('hash is independent of importBatchId (dedup must work across batches)', () => {
		const a = normalizeTransaction(row, 'batch-1');
		const b = normalizeTransaction(row, 'batch-2');
		expect(a.contentHash).toBe(b.contentHash);
		expect(a.importBatchId).not.toBe(b.importBatchId);
	});

	it('produces a different hash for a genuinely different transaction', () => {
		const a = normalizeTransaction(row, 'batch-1');
		const b = normalizeTransaction({ ...row, amount: money(-100, 'PLN') }, 'batch-1');
		expect(a.contentHash).not.toBe(b.contentHash);
	});
});
