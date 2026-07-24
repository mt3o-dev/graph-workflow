import { describe, expect, it } from 'vitest';
import { money, type Transaction } from '../model/transaction.js';
import { cashflowByCurrency } from './cashflow.js';

function tx(overrides: Partial<Transaction>): Transaction {
	const amount = overrides.amount ?? money(1000n, 'PLN');
	return {
		bookingDate: '2026-07-01',
		valueDate: '2026-07-01',
		amount,
		direction: amount.minor < 0n ? 'out' : 'in',
		counterparty: 'ACME',
		description: 'desc',
		sourceAccount: 'acc-1',
		importBatchId: 'batch-1',
		contentHash: `hash-${Math.random()}`,
		...overrides
	};
}

describe('cashflowByCurrency', () => {
	it('sums income and outcome per bucket, net = income - outcome', () => {
		const txns = [
			tx({ bookingDate: '2026-07-01', amount: money(1000n, 'PLN'), contentHash: 'a' }),
			tx({ bookingDate: '2026-07-01', amount: money(-400n, 'PLN'), contentHash: 'b' }),
			tx({ bookingDate: '2026-07-02', amount: money(-100n, 'PLN'), contentHash: 'c' })
		];

		const [series] = cashflowByCurrency(txns, 'day');

		expect(series.currency).toBe('PLN');
		expect(series.income).toEqual([{ bucket: '2026-07-01', value: 1000n }]);
		expect(series.outcome).toEqual([
			{ bucket: '2026-07-01', value: 400n },
			{ bucket: '2026-07-02', value: 100n }
		]);
		expect(series.net.find((p) => p.bucket === '2026-07-01')?.value).toBe(600n);
		expect(series.net.find((p) => p.bucket === '2026-07-02')?.value).toBe(-100n);
	});

	it('produces separate series per currency, never summed across currencies', () => {
		const txns = [
			tx({ amount: money(1000n, 'PLN'), contentHash: 'a' }),
			tx({ amount: money(500n, 'USD'), contentHash: 'b' })
		];

		const series = cashflowByCurrency(txns, 'day');

		expect(series.map((s) => s.currency).sort()).toEqual(['PLN', 'USD']);
		const pln = series.find((s) => s.currency === 'PLN')!;
		const usd = series.find((s) => s.currency === 'USD')!;
		expect(pln.income).toEqual([{ bucket: '2026-07-01', value: 1000n }]);
		expect(usd.income).toEqual([{ bucket: '2026-07-01', value: 500n }]);
	});

	it('applies fromDate/toDate filters (inclusive)', () => {
		const txns = [
			tx({ bookingDate: '2026-07-01', contentHash: 'a' }),
			tx({ bookingDate: '2026-07-05', contentHash: 'b' }),
			tx({ bookingDate: '2026-07-10', contentHash: 'c' })
		];

		const [series] = cashflowByCurrency(txns, 'day', { fromDate: '2026-07-02', toDate: '2026-07-09' });

		expect(series.income.map((p) => p.bucket)).toEqual(['2026-07-05']);
	});

	it('applies sourceAccount filter', () => {
		const txns = [
			tx({ sourceAccount: 'acc-1', contentHash: 'a' }),
			tx({ sourceAccount: 'acc-2', contentHash: 'b' })
		];

		const [series] = cashflowByCurrency(txns, 'day', { sourceAccounts: ['acc-1'] });

		expect(series.income).toEqual([{ bucket: '2026-07-01', value: 1000n }]);
	});

	it('returns [] for an empty transaction list', () => {
		expect(cashflowByCurrency([], 'day')).toEqual([]);
	});

	it('buckets by month granularity', () => {
		const txns = [
			tx({ bookingDate: '2026-07-01', contentHash: 'a' }),
			tx({ bookingDate: '2026-07-31', contentHash: 'b' })
		];

		const [series] = cashflowByCurrency(txns, 'month');

		expect(series.income).toEqual([{ bucket: '2026-07-01', value: 2000n }]);
	});
});
