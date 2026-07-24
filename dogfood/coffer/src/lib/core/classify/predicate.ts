/**
 * Pure predicate compiler ([dec:eb01608c]). Turns the serializable `Predicate`
 * DATA shape (`core/model/rule.ts`) into a pure `(tx) => boolean` matcher.
 * No I/O, no `node:` imports — boundary-lint-guarded core.
 */
import type { Transaction } from '../model/transaction.js';
import { stringFieldValue, type AmountBetweenPredicate, type AmountComparePredicate, type Predicate, type StringFieldPredicate } from '../model/rule.js';

function matchStringField(tx: Transaction, predicate: StringFieldPredicate): boolean {
	const actual = stringFieldValue(tx, predicate.field);
	switch (predicate.op) {
		case 'equals':
			return actual === predicate.value;
		case 'contains':
			return actual.includes(predicate.value);
	}
}

function matchAmountCompare(tx: Transaction, predicate: AmountComparePredicate): boolean {
	const minor = tx.amount.minor;
	switch (predicate.op) {
		case 'eq':
			return minor === predicate.value;
		case 'gt':
			return minor > predicate.value;
		case 'gte':
			return minor >= predicate.value;
		case 'lt':
			return minor < predicate.value;
		case 'lte':
			return minor <= predicate.value;
	}
}

function matchAmountBetween(tx: Transaction, predicate: AmountBetweenPredicate): boolean {
	const [min, max] = predicate.value;
	return tx.amount.minor >= min && tx.amount.minor <= max;
}

/** Compile a `Predicate` into a pure matcher function. Recursive for `all`/`any` combinators. */
export function compile(predicate: Predicate): (tx: Transaction) => boolean {
	switch (predicate.kind) {
		case 'field':
			if (predicate.field === 'amount') {
				return predicate.op === 'between'
					? (tx) => matchAmountBetween(tx, predicate)
					: (tx) => matchAmountCompare(tx, predicate);
			}
			return (tx) => matchStringField(tx, predicate);
		case 'all': {
			const matchers = predicate.predicates.map(compile);
			return (tx) => matchers.every((matches) => matches(tx));
		}
		case 'any': {
			const matchers = predicate.predicates.map(compile);
			return (tx) => matchers.some((matches) => matches(tx));
		}
	}
}
