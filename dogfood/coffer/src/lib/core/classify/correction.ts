/**
 * Manual-correction + correction->rule-promotion orchestration ([dec:65e4485f],
 * [dec:efd6891c], P4). PURE core: imports only ports + other core modules —
 * no adapters, no `node:` builtins (boundary-lint enforces this), same
 * pattern as `classify/run.ts` and `pipeline/import-pipeline.ts`.
 */
import type { Transaction } from '../model/transaction.js';
import type { Rule } from '../model/rule.js';
import type { Assignment } from '../model/assignment.js';
import type { ClassificationStorePort } from '../../ports/classification-store.port.js';
import { promoteToRule, type PromoteToRuleOptions } from './promote.js';

/**
 * Record a manual correction: persist a `source: 'manual'` assignment for
 * every group id in `groupIds`. Sticky by construction — relies entirely on
 * `ClassificationStorePort.saveAssignments`'s never-overwrite contract, same
 * as `classify/run.ts`.
 */
export async function recordManualCorrection(
	tx: Transaction,
	groupIds: readonly string[],
	store: ClassificationStorePort
): Promise<void> {
	const assignments: Assignment[] = groupIds.map((groupId) => ({
		txContentHash: tx.contentHash,
		groupId,
		source: 'manual'
	}));
	await store.saveAssignments(assignments);
}

/**
 * Promote a (typically already-recorded) manual correction on `tx` to a
 * reusable `Rule` and persist it. Does NOT re-run the engine — the caller
 * (composition root) re-runs `runClassification` afterwards over the full
 * transaction set so the new rule's effect (including reproducing this
 * correction, and matching any other transaction) is applied uniformly.
 */
export async function promoteCorrectionToRule(
	tx: Transaction,
	groupIds: readonly string[],
	opts: PromoteToRuleOptions,
	store: ClassificationStorePort
): Promise<Rule> {
	const rule = promoteToRule(tx, groupIds, opts);
	await store.upsertRule(rule);
	return rule;
}
