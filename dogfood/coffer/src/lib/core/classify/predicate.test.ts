import { describe, expect, it } from 'vitest';
import type { Transaction } from '../model/transaction.js';
import type { Predicate } from '../model/rule.js';
import { compile } from './predicate.js';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: 1000n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'Acme Corp',
		description: 'Grocery run at Acme',
		sourceAccount: 'PL00-CHECKING',
		importBatchId: 'b1',
		contentHash: 'h1',
		...overrides
	};
}

describe('compile: string field predicates', () => {
	it.each([
		['description', 'equals', 'Grocery run at Acme', true],
		['description', 'equals', 'something else', false],
		['description', 'contains', 'Grocery', true],
		['description', 'contains', 'nope', false],
		['counterparty', 'equals', 'Acme Corp', true],
		['account', 'equals', 'PL00-CHECKING', true],
		['account', 'contains', 'CHECKING', true]
	] as const)('%s %s %j matches as expected', (field, op, value, expected) => {
		const predicate: Predicate = { kind: 'field', field, op, value };
		expect(compile(predicate)(makeTx())).toBe(expected);
	});
});

describe('compile: amount predicates', () => {
	it.each([
		['eq', 1000n, true],
		['eq', 999n, false],
		['gt', 999n, true],
		['gt', 1000n, false],
		['gte', 1000n, true],
		['lt', 1001n, true],
		['lte', 1000n, true]
	] as const)('amount %s %s', (op, value, expected) => {
		const predicate: Predicate = { kind: 'field', field: 'amount', op, value };
		expect(compile(predicate)(makeTx())).toBe(expected);
	});

	it('between is inclusive on both bounds', () => {
		const predicate: Predicate = { kind: 'field', field: 'amount', op: 'between', value: [1000n, 2000n] };
		expect(compile(predicate)(makeTx({ amount: { minor: 1000n, currency: 'PLN' } }))).toBe(true);
		expect(compile(predicate)(makeTx({ amount: { minor: 2000n, currency: 'PLN' } }))).toBe(true);
		expect(compile(predicate)(makeTx({ amount: { minor: 999n, currency: 'PLN' } }))).toBe(false);
		expect(compile(predicate)(makeTx({ amount: { minor: 2001n, currency: 'PLN' } }))).toBe(false);
	});
});

describe('compile: all/any combinators', () => {
	const isGrocery: Predicate = { kind: 'field', field: 'description', op: 'contains', value: 'Grocery' };
	const isAcme: Predicate = { kind: 'field', field: 'counterparty', op: 'equals', value: 'Acme Corp' };
	const isOther: Predicate = { kind: 'field', field: 'counterparty', op: 'equals', value: 'Someone Else' };

	it('all: true only when every nested predicate matches', () => {
		expect(compile({ kind: 'all', predicates: [isGrocery, isAcme] })(makeTx())).toBe(true);
		expect(compile({ kind: 'all', predicates: [isGrocery, isOther] })(makeTx())).toBe(false);
	});

	it('all: vacuously true for an empty predicate list', () => {
		expect(compile({ kind: 'all', predicates: [] })(makeTx())).toBe(true);
	});

	it('any: true when at least one nested predicate matches', () => {
		expect(compile({ kind: 'any', predicates: [isOther, isAcme] })(makeTx())).toBe(true);
		expect(compile({ kind: 'any', predicates: [isOther] })(makeTx())).toBe(false);
	});

	it('any: vacuously false for an empty predicate list', () => {
		expect(compile({ kind: 'any', predicates: [] })(makeTx())).toBe(false);
	});

	it('nests all/any recursively', () => {
		const nested: Predicate = {
			kind: 'all',
			predicates: [isAcme, { kind: 'any', predicates: [isOther, isGrocery] }]
		};
		expect(compile(nested)(makeTx())).toBe(true);
	});
});
