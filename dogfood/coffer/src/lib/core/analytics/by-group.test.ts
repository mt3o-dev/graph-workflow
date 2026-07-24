import { describe, expect, it } from 'vitest';
import { money, type Transaction } from '../model/transaction.js';
import type { Assignment } from '../model/assignment.js';
import type { Group } from '../model/group.js';
import { attribute } from './attribution.js';
import { byGroupRollup, byGroupSelf } from './by-group.js';

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

function assign(txContentHash: string, groupId: string): Assignment {
	return { txContentHash, groupId, source: 'manual' };
}

// Tree: root (Food) -> child (Snacks) -> grandchild (Chips); sibling (Rent) at root.
const root: Group = { id: 'root', name: 'Food', parentId: null, kind: 'group' };
const child: Group = { id: 'child', name: 'Snacks', parentId: 'root', kind: 'group' };
const grandchild: Group = { id: 'grandchild', name: 'Chips', parentId: 'child', kind: 'group' };
const sibling: Group = { id: 'sibling', name: 'Rent', parentId: null, kind: 'group' };
const groups = [root, child, grandchild, sibling];

describe('byGroupSelf', () => {
	it('sums only direct assignments per group', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(1000n, 'PLN') })];
		const assignments = [assign('tx1', 'root'), assign('tx1', 'child')];
		const rows = attribute(txns, assignments, { mode: 'overlap' });

		const totals = byGroupSelf(rows, 'overlap');

		expect(totals.find((t) => t.groupId === 'root')?.amountMinor).toBe(1000n);
		expect(totals.find((t) => t.groupId === 'child')?.amountMinor).toBe(1000n);
		expect(totals.find((t) => t.groupId === 'grandchild')).toBeUndefined();
	});
});

describe('byGroupRollup: subtree-dedup', () => {
	it('a tx assigned to both a parent and its child is not double-counted within that subtree (overlap)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(1000n, 'PLN') })];
		const assignments = [assign('tx1', 'root'), assign('tx1', 'child')];
		const rows = attribute(txns, assignments, { mode: 'overlap' });

		const totals = byGroupRollup(rows, txns, groups, 'overlap');

		// root's subtree includes child+grandchild; the tx touches root and
		// child, both inside root's own subtree -> counted once, not twice.
		expect(totals.find((t) => t.groupId === 'root')?.amountMinor).toBe(1000n);
		// child's subtree is {child, grandchild} -> the tx is counted once too.
		expect(totals.find((t) => t.groupId === 'child')?.amountMinor).toBe(1000n);
	});

	it('a tx assigned only to a grandchild rolls up to every ancestor exactly once', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(500n, 'PLN') })];
		const assignments = [assign('tx1', 'grandchild')];
		const rows = attribute(txns, assignments, { mode: 'overlap' });

		const totals = byGroupRollup(rows, txns, groups, 'overlap');

		expect(totals.find((t) => t.groupId === 'grandchild')?.amountMinor).toBe(500n);
		expect(totals.find((t) => t.groupId === 'child')?.amountMinor).toBe(500n);
		expect(totals.find((t) => t.groupId === 'root')?.amountMinor).toBe(500n);
		// An unrelated sibling subtree is untouched.
		expect(totals.find((t) => t.groupId === 'sibling')).toBeUndefined();
	});

	it('a tx assigned to an unrelated sibling does not roll into root', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(200n, 'PLN') })];
		const assignments = [assign('tx1', 'sibling')];
		const rows = attribute(txns, assignments, { mode: 'overlap' });

		const totals = byGroupRollup(rows, txns, groups, 'overlap');

		expect(totals.find((t) => t.groupId === 'root')).toBeUndefined();
		expect(totals.find((t) => t.groupId === 'sibling')?.amountMinor).toBe(200n);
	});

	it('partition-rollup still reconciles to the grand total (never exceeds tx amount)', () => {
		const txns = [tx({ contentHash: 'tx1', amount: money(900n, 'PLN') })];
		// Assigned to root and grandchild -> partition splits evenly across the
		// 2 candidate groups; root's subtree (root+child+grandchild) contains
		// BOTH matched groups, so its rollup sums their disjoint parts back to
		// the full tx amount, not more.
		const assignments = [assign('tx1', 'root'), assign('tx1', 'grandchild')];
		const rows = attribute(txns, assignments, { mode: 'partition' });

		const totals = byGroupRollup(rows, txns, groups, 'partition');

		expect(totals.find((t) => t.groupId === 'root')?.amountMinor).toBe(900n);
		expect(totals.find((t) => t.groupId === 'child')?.amountMinor).toBe(450n); // only grandchild's half is in child's subtree
	});

	it('overlap-rollup at root may exceed the grand total across unrelated branches (labeled, expected)', () => {
		const txns = [
			tx({ contentHash: 'tx1', amount: money(300n, 'PLN') }),
			tx({ contentHash: 'tx2', amount: money(400n, 'PLN') })
		];
		const assignments = [assign('tx1', 'child'), assign('tx2', 'sibling')];
		const rows = attribute(txns, assignments, { mode: 'overlap' });

		const totals = byGroupRollup(rows, txns, groups, 'overlap');

		expect(totals.find((t) => t.groupId === 'root')?.amountMinor).toBe(300n);
		expect(totals.find((t) => t.groupId === 'sibling')?.amountMinor).toBe(400n);
	});
});
