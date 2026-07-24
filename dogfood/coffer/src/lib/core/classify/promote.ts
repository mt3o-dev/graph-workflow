/**
 * Correction -> rule promotion ([dec:65e4485f], P4). PURE core: takes a
 * transaction + the corrected group set and derives a `Rule` whose predicate
 * reproduces the correction on re-evaluation, without touching any store.
 *
 * Predicate derivation (settled in the plan): default to a `counterparty
 * equals` match; fall back to `description equals` when `counterparty` is
 * empty. `id`/`order` (and any other identity/ordering concerns) are the
 * caller's (composition root's) responsibility — pure core cannot mint ids
 * or read "the next rule order" from a store.
 */
import type { Transaction } from '../model/transaction.js';
import type { Predicate, Rule } from '../model/rule.js';

export interface PromoteToRuleOptions {
	/** Caller-minted rule id (pure core does not generate ids). */
	readonly id: string;
	/** Caller-chosen position in the ordered rule list. */
	readonly order: number;
	readonly name?: string;
	readonly stopAfter?: boolean;
}

/** Derive the predicate a promoted rule should use to reproduce a correction on `tx`. */
export function derivePredicate(tx: Transaction): Predicate {
	if (tx.counterparty.length > 0) {
		return { kind: 'field', field: 'counterparty', op: 'equals', value: tx.counterparty };
	}
	return { kind: 'field', field: 'description', op: 'equals', value: tx.description };
}

/**
 * Build a `Rule` from a corrected transaction + its corrected group set.
 * Appending the resulting rule and re-running `classify` reproduces the
 * correction for `tx` and every other transaction the derived predicate
 * matches — see `classify/engine.ts` and `classify/correction.ts`.
 */
export function promoteToRule(
	tx: Transaction,
	groupIds: readonly string[],
	opts: PromoteToRuleOptions
): Rule {
	return {
		id: opts.id,
		name: opts.name,
		order: opts.order,
		predicate: derivePredicate(tx),
		assign: groupIds,
		stopAfter: opts.stopAfter
	};
}
