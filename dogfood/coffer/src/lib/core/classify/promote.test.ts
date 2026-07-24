import { describe, expect, it } from 'vitest';
import type { Transaction } from '../model/transaction.js';
import { derivePredicate, promoteToRule } from './promote.js';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: -1000n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'ACME',
		description: 'Groceries at ACME',
		sourceAccount: 'PL00',
		importBatchId: 'b1',
		contentHash: 'tx1',
		...overrides
	};
}

describe('derivePredicate', () => {
	it('defaults to a counterparty-equals predicate', () => {
		expect(derivePredicate(makeTx({ counterparty: 'ACME' }))).toEqual({
			kind: 'field',
			field: 'counterparty',
			op: 'equals',
			value: 'ACME'
		});
	});

	it('falls back to a description-equals predicate when counterparty is empty', () => {
		expect(derivePredicate(makeTx({ counterparty: '', description: 'Cash withdrawal' }))).toEqual({
			kind: 'field',
			field: 'description',
			op: 'equals',
			value: 'Cash withdrawal'
		});
	});
});

describe('promoteToRule', () => {
	it('builds a Rule from the corrected tx + group set, using caller-supplied id/order', () => {
		const rule = promoteToRule(makeTx(), ['g1', 'g2'], { id: 'r-promoted', order: 3 });

		expect(rule).toEqual({
			id: 'r-promoted',
			name: undefined,
			order: 3,
			predicate: { kind: 'field', field: 'counterparty', op: 'equals', value: 'ACME' },
			assign: ['g1', 'g2'],
			stopAfter: undefined
		});
	});

	it('threads through optional name and stopAfter', () => {
		const rule = promoteToRule(makeTx(), ['g1'], {
			id: 'r-promoted',
			order: 0,
			name: 'ACME -> Groceries',
			stopAfter: true
		});

		expect(rule.name).toBe('ACME -> Groceries');
		expect(rule.stopAfter).toBe(true);
	});
});
