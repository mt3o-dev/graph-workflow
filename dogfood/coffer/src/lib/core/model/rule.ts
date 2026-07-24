/**
 * Domain model: Rule + Predicate ([dec:eb01608c], [dec:6] core purity).
 *
 * Pure TS only — no `node:` imports, no runtime libraries (boundary-lint
 * enforces this for everything under src/lib/core/**).
 *
 * A predicate is serializable DATA (a discriminated union), never a JS
 * function, so rules can be persisted (P3) and minted from corrections (P4)
 * without eval/Function tricks. `src/lib/core/classify/predicate.ts` compiles
 * this data shape into a pure `(tx) => boolean` matcher.
 */
import type { Transaction } from './transaction.js';

/** String-valued transaction fields a rule can match on. */
export type StringField = 'description' | 'counterparty' | 'account';

export type StringOp = 'equals' | 'contains';

export interface StringFieldPredicate {
	readonly kind: 'field';
	readonly field: StringField;
	readonly op: StringOp;
	readonly value: string;
}

/** Single-bound amount comparisons, in Money.minor units (same as `Transaction.amount.minor`). */
export type AmountCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface AmountComparePredicate {
	readonly kind: 'field';
	readonly field: 'amount';
	readonly op: AmountCompareOp;
	readonly value: bigint;
}

/** Inclusive `[min, max]` range, in Money.minor units. */
export interface AmountBetweenPredicate {
	readonly kind: 'field';
	readonly field: 'amount';
	readonly op: 'between';
	readonly value: readonly [bigint, bigint];
}

export type FieldPredicate = StringFieldPredicate | AmountComparePredicate | AmountBetweenPredicate;

/** AND: every nested predicate must match. Vacuously true for an empty list. */
export interface AllPredicate {
	readonly kind: 'all';
	readonly predicates: readonly Predicate[];
}

/** OR: at least one nested predicate must match. Vacuously false for an empty list. */
export interface AnyPredicate {
	readonly kind: 'any';
	readonly predicates: readonly Predicate[];
}

export type Predicate = FieldPredicate | AllPredicate | AnyPredicate;

/**
 * A classification rule. `order` drives the engine's ordered evaluation
 * (lower first); `assign` is the set of group ids a match contributes to the
 * additive union; `stopAfter` halts further rule evaluation for that
 * transaction once this rule matches (the exclusivity escape).
 */
export interface Rule {
	readonly id: string;
	readonly name?: string;
	readonly order: number;
	readonly predicate: Predicate;
	readonly assign: readonly string[];
	readonly stopAfter?: boolean;
}

/** Read a transaction's value for a string-typed rule field. */
export function stringFieldValue(tx: Transaction, field: StringField): string {
	switch (field) {
		case 'description':
			return tx.description;
		case 'counterparty':
			return tx.counterparty;
		case 'account':
			return tx.sourceAccount;
	}
}
