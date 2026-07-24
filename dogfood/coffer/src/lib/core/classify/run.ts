/**
 * Classification-run orchestration + the derived review queue
 * ([dec:efd6891c], P3). PURE core: this file may import only ports and other
 * core modules — no adapters, no `node:` builtins, no framework
 * (boundary-lint enforces this), same pattern as `pipeline/import-pipeline.ts`.
 *
 * `runClassification` re-evaluates the pure engine (P2) against the given
 * transactions/rules and persists the resulting rule-sourced assignments.
 * Re-running it is safe by construction: `ClassificationStorePort.saveAssignments`
 * is defined to be idempotent and to never overwrite an existing row for a
 * `(txContentHash, groupId)` pair (sticky-manual, R4) — this orchestrator adds
 * no additional logic to enforce that, it relies entirely on the store's
 * contract.
 */
import type { Transaction } from '../model/transaction.js';
import type { Rule } from '../model/rule.js';
import type { ClassificationStorePort } from '../../ports/classification-store.port.js';
import { classify } from './engine.js';

export interface ClassificationRunResult {
	/** Assignments the pure engine produced for this run (before store dedup/sticky filtering). */
	readonly assignmentsProduced: number;
}

/**
 * Classify `txns` against `rules` and persist the resulting `source: 'rule'`
 * assignments via `store.saveAssignments`. Safe to call repeatedly (e.g. on
 * every app start, or after a rule edit) — see the file doc above.
 */
export async function runClassification(
	txns: readonly Transaction[],
	rules: readonly Rule[],
	store: ClassificationStorePort
): Promise<ClassificationRunResult> {
	const assignments = classify(txns, rules);
	await store.saveAssignments(assignments);
	return { assignmentsProduced: assignments.length };
}

/**
 * The review queue: the subset of `txns` with zero recorded assignments
 * (any source) — a derived read, never a separately persisted table
 * ([dec:efd6891c]). Preserves `txns`' input order.
 */
export async function reviewQueue(
	txns: readonly Transaction[],
	store: ClassificationStorePort
): Promise<Transaction[]> {
	const hashes = txns.map((t) => t.contentHash);
	const unmatchedHashes = new Set(await store.unmatched(hashes));
	return txns.filter((t) => unmatchedHashes.has(t.contentHash));
}
