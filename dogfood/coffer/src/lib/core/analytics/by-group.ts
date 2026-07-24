/**
 * By-group rollup over attributed rows (coffer-analytics slice 3, P3).
 * Two labeled shapes, over the nestable group tree (`core/model/group.ts`):
 * - `self`: direct assignments only — the group's own `AttributedRow`s.
 * - `rollup`: subtree-deduped — a tx counts into an ancestor group's total
 *   if assigned to that ancestor OR any descendant, counted ONCE per
 *   subtree so a tx assigned to both a parent and its child is not
 *   double-counted within that subtree ([node:534f6ff8]).
 *
 * Rollup composes with mode: under `partition`, a tx's attributed rows
 * within a subtree already sum disjointly (partition never assigns more
 * than the tx's total across ALL its matched groups), so summing the
 * in-subtree rows for that tx is exact and never exceeds the tx amount.
 * Under `overlap`, every matched group holds the FULL tx amount, so naively
 * summing in-subtree rows would double-count a tx matched at both a parent
 * and a descendant — instead the subtree counts that tx's FULL amount
 * exactly ONCE (mirrors the "does this tx belong to the subtree" boolean
 * semantics of overlap-self, just deduped across the whole subtree).
 *
 * Pure TS only, zero I/O.
 */
import type { Group } from '../model/group.js';
import { childrenOf } from '../model/group.js';
import type { Transaction } from '../model/transaction.js';
import type { AttributionMode } from './model.js';
import type { AttributedRow } from './attribution.js';

export type RollupVariant = 'self' | 'rollup';

/** One group's total for one currency, under a given mode + variant. */
export interface GroupTotal {
	readonly groupId: string;
	readonly mode: AttributionMode;
	readonly variant: RollupVariant;
	readonly currency: string;
	readonly amountMinor: bigint;
}

/** `groupId` plus every descendant id, transitively (self included). */
function subtreeIds(groups: readonly Group[], rootId: string): Set<string> {
	const ids = new Set<string>([rootId]);
	const queue = [rootId];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const child of childrenOf(groups, current)) {
			if (!ids.has(child.id)) {
				ids.add(child.id);
				queue.push(child.id);
			}
		}
	}
	return ids;
}

function addTo(map: Map<string, bigint>, currency: string, amount: bigint): void {
	map.set(currency, (map.get(currency) ?? 0n) + amount);
}

/** Direct-assignment totals only: one `GroupTotal` per (group, currency) with a nonzero-row presence. */
export function byGroupSelf(rows: readonly AttributedRow[], mode: AttributionMode): GroupTotal[] {
	const totals = new Map<string, Map<string, bigint>>(); // groupId -> currency -> amount
	for (const row of rows) {
		let byCurrency = totals.get(row.groupId);
		if (!byCurrency) {
			byCurrency = new Map();
			totals.set(row.groupId, byCurrency);
		}
		addTo(byCurrency, row.currency, row.amountMinor);
	}

	const result: GroupTotal[] = [];
	for (const [groupId, byCurrency] of totals) {
		for (const [currency, amountMinor] of byCurrency) {
			result.push({ groupId, mode, variant: 'self', currency, amountMinor });
		}
	}
	return result;
}

/**
 * Subtree-deduped totals for every group in `groups`: for group `g`, sums
 * every transaction whose attributed rows touch `g` or any descendant of
 * `g`, counting each such transaction's contribution to the subtree exactly
 * once (see module doc for the overlap-vs-partition distinction).
 */
export function byGroupRollup(
	rows: readonly AttributedRow[],
	txns: readonly Transaction[],
	groups: readonly Group[],
	mode: AttributionMode
): GroupTotal[] {
	const txByHash = new Map(txns.map((t) => [t.contentHash, t] as const));

	// Pre-index rows by txContentHash for fast per-tx lookups.
	const rowsByTx = new Map<string, AttributedRow[]>();
	for (const row of rows) {
		let list = rowsByTx.get(row.txContentHash);
		if (!list) {
			list = [];
			rowsByTx.set(row.txContentHash, list);
		}
		list.push(row);
	}

	const result: GroupTotal[] = [];
	for (const group of groups) {
		const subtree = subtreeIds(groups, group.id);
		const totalsByCurrency = new Map<string, bigint>();

		for (const [txContentHash, txRows] of rowsByTx) {
			const inSubtree = txRows.filter((r) => subtree.has(r.groupId));
			if (inSubtree.length === 0) {
				continue;
			}
			const currency = inSubtree[0].currency;
			if (mode === 'overlap') {
				const tx = txByHash.get(txContentHash);
				const fullAmount = tx ? tx.amount.minor : inSubtree[0].amountMinor;
				addTo(totalsByCurrency, currency, fullAmount);
			} else {
				const subtreeSum = inSubtree.reduce((acc, r) => acc + r.amountMinor, 0n);
				addTo(totalsByCurrency, currency, subtreeSum);
			}
		}

		for (const [currency, amountMinor] of totalsByCurrency) {
			result.push({ groupId: group.id, mode, variant: 'rollup', currency, amountMinor });
		}
	}
	return result;
}
