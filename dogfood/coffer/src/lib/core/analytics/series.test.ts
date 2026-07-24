import { describe, expect, it } from 'vitest';
import { money, type Transaction } from '../model/transaction.js';
import type { Assignment } from '../model/assignment.js';
import type { Group } from '../model/group.js';
import { byGroupSeriesSets, cashflowSeriesSets } from './series.js';

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
		contentHash: 'tx',
		...overrides
	};
}

describe('cashflowSeriesSets', () => {
	it('produces one SeriesSet per currency, each with income/outcome/net series', () => {
		const txns = [
			tx({ contentHash: 'tx1', amount: money(1000n, 'PLN') }),
			tx({ contentHash: 'tx2', amount: money(-400n, 'PLN') })
		];

		const sets = cashflowSeriesSets(txns, 'day');

		expect(sets).toHaveLength(1);
		const [set] = sets;
		expect(set.currency).toBe('PLN');
		expect(set.series.map((s) => s.id).sort()).toEqual(['income', 'net', 'outcome']);
		expect(set.grandTotalMinor).toBe(600n);
		for (const series of set.series) {
			expect(series.mode).toBe('overlap');
			expect(series.currency).toBe('PLN');
		}
	});

	it('is DATA-only: no functions/components on the returned shape', () => {
		const sets = cashflowSeriesSets([tx({ contentHash: 'tx1' })], 'day');
		expect(JSON.stringify(sets, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('function');
	});
});

describe('byGroupSeriesSets', () => {
	const g1: Group = { id: 'g1', name: 'Groceries', parentId: null, kind: 'group' };
	const g2: Group = { id: 'g2', name: 'Dining', parentId: null, kind: 'group' };
	const groups = [g1, g2];

	function assign(txContentHash: string, groupId: string): Assignment {
		return { txContentHash, groupId, source: 'manual' };
	}

	it('partition self series reconcile exactly to grandTotalMinor', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2')];

		const [set] = byGroupSeriesSets(txns, assignments, groups, { mode: 'partition', variant: 'self' });

		const seriesTotal = set.series.reduce((acc, s) => acc + s.points.reduce((a, p) => a + p.value, 0n), 0n);
		expect(seriesTotal).toBe(set.grandTotalMinor);
		expect(set.grandTotalMinor).toBe(900n);
	});

	it('overlap self series may exceed grandTotalMinor (labeled)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2')];

		const [set] = byGroupSeriesSets(txns, assignments, groups, { mode: 'overlap', variant: 'self' });

		const seriesTotal = set.series.reduce((acc, s) => acc + s.points.reduce((a, p) => a + p.value, 0n), 0n);
		expect(seriesTotal).toBeGreaterThan(set.grandTotalMinor);
		expect(seriesTotal).toBe(1800n);
	});

	it('series carry group label and mode', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(500n, 'PLN') })];
		const assignments = [assign('tx1', 'g1')];

		const [set] = byGroupSeriesSets(txns, assignments, groups, { mode: 'partition', variant: 'self' });

		expect(set.series).toEqual([
			{ id: 'g1', label: 'Groceries', mode: 'partition', currency: 'PLN', points: [{ bucket: 'total', value: 500n }] }
		]);
	});
});
