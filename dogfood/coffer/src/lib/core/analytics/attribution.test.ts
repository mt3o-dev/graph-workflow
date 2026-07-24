import { describe, expect, it } from 'vitest';
import { money, type Transaction } from '../model/transaction.js';
import type { Assignment } from '../model/assignment.js';
import { attribute, type PrimaryGroupOf } from './attribution.js';

function tx(overrides: Partial<Transaction> = {}): Transaction {
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
		contentHash: 'tx1',
		...overrides
	};
}

function assign(txContentHash: string, groupId: string): Assignment {
	return { txContentHash, groupId, source: 'manual' };
}

describe('attribute: overlap mode', () => {
	it('every matched group gets the full tx amount', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(1000n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2')];

		const rows = attribute(txns, assignments, { mode: 'overlap' });

		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.amountMinor === 1000n)).toBe(true);
		const total = rows.reduce((acc, r) => acc + r.amountMinor, 0n);
		expect(total).toBe(2000n); // exceeds grand total (1000n) - expected/labeled by mode
	});

	it('unmatched transactions (zero assignments) produce zero rows', () => {
		const txns = [tx({ contentHash: 'tx1' })];
		expect(attribute(txns, [], { mode: 'overlap' })).toEqual([]);
	});
});

describe('attribute: partition mode - even split', () => {
	it('splits evenly across matched groups and reconciles exactly (evenly divisible)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx1', 'g3')];

		const rows = attribute(txns, assignments, { mode: 'partition' });

		expect(rows.map((r) => r.amountMinor)).toEqual([300n, 300n, 300n]);
		expect(rows.reduce((acc, r) => acc + r.amountMinor, 0n)).toBe(900n);
	});

	it('distributes the remainder deterministically by sorted groupId (positive amount)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(1000n, 'PLN') })];
		// 1000 / 3 = 333 remainder 1 -> first sorted group gets +1
		const assignments = [assign('tx1', 'gZ'), assign('tx1', 'gA'), assign('tx1', 'gM')];

		const rows = attribute(txns, assignments, { mode: 'partition' });
		const byGroup = new Map(rows.map((r) => [r.groupId, r.amountMinor]));

		expect(byGroup.get('gA')).toBe(334n); // sorted-first gets the +1 remainder
		expect(byGroup.get('gM')).toBe(333n);
		expect(byGroup.get('gZ')).toBe(333n);
		expect(rows.reduce((acc, r) => acc + r.amountMinor, 0n)).toBe(1000n);
	});

	it('distributes the remainder deterministically for a negative (outflow) amount', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(-1000n, 'PLN') })];
		const assignments = [assign('tx1', 'gZ'), assign('tx1', 'gA'), assign('tx1', 'gM')];

		const rows = attribute(txns, assignments, { mode: 'partition' });
		const byGroup = new Map(rows.map((r) => [r.groupId, r.amountMinor]));

		expect(byGroup.get('gA')).toBe(-334n);
		expect(byGroup.get('gM')).toBe(-333n);
		expect(byGroup.get('gZ')).toBe(-333n);
		expect(rows.reduce((acc, r) => acc + r.amountMinor, 0n)).toBe(-1000n);
	});

	it('single matched group receives the full amount', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(777n, 'PLN') })];
		const rows = attribute(txns, [assign('tx1', 'g1')], { mode: 'partition' });

		expect(rows).toEqual([{ txContentHash: 'tx1', groupId: 'g1', currency: 'PLN', amountMinor: 777n }]);
	});
});

describe('attribute: partition mode - primary-else-even [plan-review mandatory branch]', () => {
	it('when primaryGroupOf resolves a group, that group gets the FULL amount and all others get ZERO, exact reconciliation', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(1234n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx1', 'g3')];
		const primaryGroupOf: PrimaryGroupOf = () => 'g2';

		const rows = attribute(txns, assignments, { mode: 'partition', primaryGroupOf });
		const byGroup = new Map(rows.map((r) => [r.groupId, r.amountMinor]));

		expect(byGroup.get('g2')).toBe(1234n);
		expect(byGroup.get('g1')).toBe(0n);
		expect(byGroup.get('g3')).toBe(0n);
		expect(rows.reduce((acc, r) => acc + r.amountMinor, 0n)).toBe(1234n);
	});

	it('falls back to even split when primaryGroupOf returns undefined', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx1', 'g3')];
		const primaryGroupOf: PrimaryGroupOf = () => undefined;

		const rows = attribute(txns, assignments, { mode: 'partition', primaryGroupOf });

		expect(rows.map((r) => r.amountMinor)).toEqual([300n, 300n, 300n]);
	});

	it('falls back to even split when primaryGroupOf resolves a group not among the candidates', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx1', 'g3')];
		const primaryGroupOf: PrimaryGroupOf = () => 'not-a-candidate';

		const rows = attribute(txns, assignments, { mode: 'partition', primaryGroupOf });

		expect(rows.map((r) => r.amountMinor)).toEqual([300n, 300n, 300n]);
	});

	it('primary resolution can vary per transaction (per-call policy input, not persisted)', () => {
		const txns = [
			tx({ contentHash: 'tx1', amount: money(100n, 'PLN') }),
			tx({ contentHash: 'tx2', amount: money(200n, 'PLN') })
		];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx2', 'g1'), assign('tx2', 'g2')];
		const primaryGroupOf: PrimaryGroupOf = (txContentHash) => (txContentHash === 'tx1' ? 'g1' : 'g2');

		const rows = attribute(txns, assignments, { mode: 'partition', primaryGroupOf });

		const tx1Rows = new Map(rows.filter((r) => r.txContentHash === 'tx1').map((r) => [r.groupId, r.amountMinor]));
		const tx2Rows = new Map(rows.filter((r) => r.txContentHash === 'tx2').map((r) => [r.groupId, r.amountMinor]));
		expect(tx1Rows.get('g1')).toBe(100n);
		expect(tx1Rows.get('g2')).toBe(0n);
		expect(tx2Rows.get('g1')).toBe(0n);
		expect(tx2Rows.get('g2')).toBe(200n);
	});
});

describe('attribute: reconciliation property tests', () => {
	function makeGroups(n: number): string[] {
		const letters = 'ABCDEFGHIJ';
		return Array.from({ length: n }, (_, i) => `g${letters[i]}`);
	}

	it('partition (even) always reconciles exactly to the tx amount, for many amounts/group-counts', () => {
		// Deterministic pseudo-random sweep, no external property-testing lib.
		let seed = 42;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed;
		};

		for (let trial = 0; trial < 200; trial++) {
			const groupCount = 1 + (rand() % 6);
			const amountSign = rand() % 2 === 0 ? 1n : -1n;
			const amountMagnitude = BigInt(rand() % 100000);
			const amount = amountSign * amountMagnitude;

			const groups = makeGroups(groupCount);
			const txns = [tx({ contentHash: 'tx1', amount: money(amount, 'PLN') })];
			const assignments = groups.map((g) => assign('tx1', g));

			const rows = attribute(txns, assignments, { mode: 'partition' });
			const total = rows.reduce((acc, r) => acc + r.amountMinor, 0n);

			expect(total).toBe(amount);
			expect(rows).toHaveLength(groupCount);
		}
	});

	it('overlap sums across groups >= |grand total| whenever more than one group matches (never exact unless one group)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(500n, 'PLN') })];
		const assignments = [assign('tx1', 'g1'), assign('tx1', 'g2'), assign('tx1', 'g3')];

		const rows = attribute(txns, assignments, { mode: 'overlap' });
		const total = rows.reduce((acc, r) => acc + r.amountMinor, 0n);

		expect(total).toBe(1500n);
		expect(total).toBeGreaterThan(500n);
	});

	it('across a multi-tx, multi-currency fixture, partition reconciles exactly per currency', () => {
		const txns = [
			tx({ contentHash: 'tx1', amount: money(1001n, 'PLN') }),
			tx({ contentHash: 'tx2', amount: money(-333n, 'PLN') }),
			tx({ contentHash: 'tx3', amount: money(500n, 'USD') })
		];
		const assignments = [
			assign('tx1', 'g1'),
			assign('tx1', 'g2'),
			assign('tx2', 'g1'),
			assign('tx2', 'g3'),
			assign('tx3', 'g1')
		];

		const rows = attribute(txns, assignments, { mode: 'partition' });

		const plnTotal = rows.filter((r) => r.currency === 'PLN').reduce((acc, r) => acc + r.amountMinor, 0n);
		const usdTotal = rows.filter((r) => r.currency === 'USD').reduce((acc, r) => acc + r.amountMinor, 0n);
		expect(plnTotal).toBe(1001n - 333n);
		expect(usdTotal).toBe(500n);
	});
});
