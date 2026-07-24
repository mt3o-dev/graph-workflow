/**
 * Attribution: overlap vs partition resolution of a transaction's amount
 * across its matched groups (coffer-analytics slice 3, P3, [node:bc0ab42f],
 * [node:534f6ff8] never assume one-group-per-tx, [node:ac2535ce] splits
 * deferred — partition = primary-else-even, NO split table).
 *
 * Pure TS only, zero I/O. All arithmetic on `Money.minor` (bigint).
 */
import type { Assignment } from '../model/assignment.js';
import type { Transaction } from '../model/transaction.js';
import type { AttributionMode } from './model.js';

/**
 * Optional pure policy: given a transaction's content hash and its matched
 * candidate group ids (in the order derived from `assignments`), return the
 * "primary" group id to receive the FULL amount under `partition` mode, or
 * `undefined`/omit to fall back to an even split. Deliberately NOT a stored
 * field ([node:ac2535ce]) — a per-call policy input only.
 */
export type PrimaryGroupOf = (
	txContentHash: string,
	candidateGroupIds: readonly string[]
) => string | undefined;

/** One (transaction, group, attributed amount) row — the atomic output of attribution. */
export interface AttributedRow {
	readonly txContentHash: string;
	readonly groupId: string;
	readonly currency: string;
	/** The amount attributed to this (tx, group) pair under the requested mode. Signed, same sign as the tx amount. */
	readonly amountMinor: bigint;
}

export interface AttributionOptions {
	readonly mode: AttributionMode;
	/** Only meaningful when `mode: 'partition'`. Default: no primary resolution -> even split. */
	readonly primaryGroupOf?: PrimaryGroupOf;
}

/** Group assignments by transaction content hash, preserving the input `assignments` order within each tx. */
function groupIdsByTx(assignments: readonly Assignment[]): Map<string, string[]> {
	const byTx = new Map<string, string[]>();
	for (const a of assignments) {
		let ids = byTx.get(a.txContentHash);
		if (!ids) {
			ids = [];
			byTx.set(a.txContentHash, ids);
		}
		if (!ids.includes(a.groupId)) {
			ids.push(a.groupId);
		}
	}
	return byTx;
}

/**
 * Split `total` (bigint) evenly across `n` group ids sorted ascending by id,
 * distributing the remainder deterministically: each group gets
 * `total / n`, then the first `|total % n|` groups (by sorted id) get one
 * extra minor unit in the direction of `total`'s sign. Guarantees the parts
 * sum EXACTLY to `total`.
 */
function evenSplit(total: bigint, groupIds: readonly string[]): Map<string, bigint> {
	const sorted = [...groupIds].sort();
	const n = BigInt(sorted.length);
	const base = total / n;
	let remainder = total % n;
	const remainderCount = remainder < 0n ? -remainder : remainder;
	const step = remainder < 0n ? -1n : 1n;

	const parts = new Map<string, bigint>();
	for (let i = 0; i < sorted.length; i++) {
		const extra = BigInt(i) < remainderCount ? step : 0n;
		parts.set(sorted[i], base + extra);
	}
	return parts;
}

/**
 * Attribute every (tx, group) assignment to a signed amount according to
 * `opts.mode`:
 * - `overlap`: every matched group gets the FULL tx amount (rows may sum to
 *   more than the tx amount across groups — expected).
 * - `partition`: the tx amount is split ONCE across its matched groups.
 *   If `opts.primaryGroupOf` resolves a group among the candidates, that
 *   group receives the FULL amount and every other matched group receives
 *   ZERO (still reconciles exactly: full + zeros = total). Otherwise the
 *   amount is split evenly via `evenSplit`.
 *
 * Transactions with zero matched groups produce zero rows (unmatched —
 * outside attribution's concern, see the review queue).
 */
export function attribute(
	txns: readonly Transaction[],
	assignments: readonly Assignment[],
	opts: AttributionOptions
): AttributedRow[] {
	const byTx = groupIdsByTx(assignments);
	const rows: AttributedRow[] = [];

	for (const tx of txns) {
		const groupIds = byTx.get(tx.contentHash);
		if (!groupIds || groupIds.length === 0) {
			continue;
		}

		if (opts.mode === 'overlap') {
			for (const groupId of groupIds) {
				rows.push({
					txContentHash: tx.contentHash,
					groupId,
					currency: tx.amount.currency,
					amountMinor: tx.amount.minor
				});
			}
			continue;
		}

		// mode: 'partition'
		const primary = opts.primaryGroupOf?.(tx.contentHash, groupIds);
		if (primary !== undefined && groupIds.includes(primary)) {
			for (const groupId of groupIds) {
				rows.push({
					txContentHash: tx.contentHash,
					groupId,
					currency: tx.amount.currency,
					amountMinor: groupId === primary ? tx.amount.minor : 0n
				});
			}
			continue;
		}

		const parts = evenSplit(tx.amount.minor, groupIds);
		for (const groupId of groupIds) {
			rows.push({
				txContentHash: tx.contentHash,
				groupId,
				currency: tx.amount.currency,
				amountMinor: parts.get(groupId) ?? 0n
			});
		}
	}

	return rows;
}
