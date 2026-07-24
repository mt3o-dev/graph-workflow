/**
 * Pure classification engine ([dec:eb01608c], [dec:5da27e33]). No I/O — takes
 * transactions + rules, returns assignments. Persistence (P3) and the
 * derived review-queue read live behind `ClassificationStorePort`, not here.
 *
 * Semantics (settled in the plan, load-bearing):
 * - Rules are evaluated in ascending `order` against EVERY transaction.
 * - A matching rule contributes the ADDITIVE UNION of its `assign` group ids
 *   to that transaction — never first-match-wins.
 * - A matching rule with `stopAfter: true` halts further rule evaluation for
 *   that transaction (an explicit exclusivity escape), but its own `assign`
 *   groups are still added before stopping.
 * - A transaction matched by zero rules produces zero assignments — the
 *   caller/store layer treats "zero assignments" as unmatched (the
 *   review-queue outcome is a DERIVED read, per [dec:efd6891c], not a value
 *   this pure function returns).
 */
import type { Transaction } from '../model/transaction.js';
import type { Rule } from '../model/rule.js';
import { compile } from './predicate.js';

/** One (transaction, group) pairing produced by the engine — always `source: 'rule'`. */
export interface Assignment {
	readonly txContentHash: string;
	readonly groupId: string;
	readonly source: 'rule';
	readonly ruleId: string;
}

/**
 * Classify every transaction against every rule. Returns assignments in a
 * stable order: transactions in input order, and within a transaction,
 * groups in the order they were first added (rule order, then `assign`
 * array order). A given (tx, group) pair never appears twice, even if two
 * different matching rules both assign the same group.
 */
export function classify(txns: readonly Transaction[], rules: readonly Rule[]): Assignment[] {
	const orderedRules = [...rules].sort((a, b) => a.order - b.order);
	const compiledRules = orderedRules.map((rule) => ({ rule, matches: compile(rule.predicate) }));

	const assignments: Assignment[] = [];
	for (const tx of txns) {
		const assignedGroupIds = new Set<string>();
		for (const { rule, matches } of compiledRules) {
			if (!matches(tx)) {
				continue;
			}
			for (const groupId of rule.assign) {
				if (assignedGroupIds.has(groupId)) {
					continue;
				}
				assignedGroupIds.add(groupId);
				assignments.push({ txContentHash: tx.contentHash, groupId, source: 'rule', ruleId: rule.id });
			}
			if (rule.stopAfter) {
				break;
			}
		}
	}
	return assignments;
}
