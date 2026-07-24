import { describe, expect, it } from 'vitest';
import type { Transaction } from '../model/transaction.js';
import type { Predicate, Rule } from '../model/rule.js';
import { classify } from './engine.js';

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

const matchesEverything: Predicate = { kind: 'all', predicates: [] };
const matchesNothing: Predicate = { kind: 'any', predicates: [] };

function makeRule(overrides: Partial<Rule> = {}): Rule {
	return {
		id: 'r1',
		order: 0,
		predicate: matchesEverything,
		assign: ['groceries'],
		...overrides
	};
}

describe('classify: empty rule set', () => {
	it('produces no assignments when there are no rules', () => {
		expect(classify([makeTx()], [])).toEqual([]);
	});

	it('produces no assignments for a transaction no rule matches', () => {
		const rule = makeRule({ predicate: matchesNothing });
		expect(classify([makeTx()], [rule])).toEqual([]);
	});
});

describe('classify: additivity', () => {
	it('accumulates the union of assign from every matching rule (not first-match)', () => {
		const rule1 = makeRule({ id: 'r1', order: 0, assign: ['groceries'] });
		const rule2 = makeRule({ id: 'r2', order: 1, assign: ['recurring'] });

		const assignments = classify([makeTx()], [rule1, rule2]);

		expect(assignments).toEqual([
			{ txContentHash: 'h1', groupId: 'groceries', source: 'rule', ruleId: 'r1' },
			{ txContentHash: 'h1', groupId: 'recurring', source: 'rule', ruleId: 'r2' }
		]);
	});

	it('does not duplicate a group id assigned by two different matching rules', () => {
		const rule1 = makeRule({ id: 'r1', order: 0, assign: ['groceries'] });
		const rule2 = makeRule({ id: 'r2', order: 1, assign: ['groceries', 'recurring'] });

		const assignments = classify([makeTx()], [rule1, rule2]);

		expect(assignments).toEqual([
			{ txContentHash: 'h1', groupId: 'groceries', source: 'rule', ruleId: 'r1' },
			{ txContentHash: 'h1', groupId: 'recurring', source: 'rule', ruleId: 'r2' }
		]);
	});
});

describe('classify: multi-group single tx', () => {
	it('a single matching rule can assign more than one group', () => {
		const rule = makeRule({ id: 'r1', assign: ['groceries', 'recurring', 'household'] });

		const assignments = classify([makeTx()], [rule]);

		expect(assignments.map((a) => a.groupId)).toEqual(['groceries', 'recurring', 'household']);
		expect(assignments.every((a) => a.txContentHash === 'h1' && a.ruleId === 'r1')).toBe(true);
	});
});

describe('classify: ordering', () => {
	it('evaluates rules by ascending `order`, regardless of input array order', () => {
		const first = makeRule({ id: 'first', order: 0, assign: ['a'] });
		const second = makeRule({ id: 'second', order: 1, assign: ['b'] });

		// Pass rules in reverse order — output must still reflect ascending `order`.
		const assignments = classify([makeTx()], [second, first]);

		expect(assignments.map((a) => a.ruleId)).toEqual(['first', 'second']);
	});
});

describe('classify: stopAfter', () => {
	it('halts evaluation of later rules for that tx once a stopAfter rule matches', () => {
		const first = makeRule({ id: 'first', order: 0, assign: ['a'], stopAfter: true });
		const second = makeRule({ id: 'second', order: 1, assign: ['b'] });

		const assignments = classify([makeTx()], [first, second]);

		expect(assignments).toEqual([{ txContentHash: 'h1', groupId: 'a', source: 'rule', ruleId: 'first' }]);
	});

	it('a non-matching stopAfter rule does not halt evaluation', () => {
		const first = makeRule({ id: 'first', order: 0, predicate: matchesNothing, assign: ['a'], stopAfter: true });
		const second = makeRule({ id: 'second', order: 1, assign: ['b'] });

		const assignments = classify([makeTx()], [first, second]);

		expect(assignments.map((a) => a.groupId)).toEqual(['b']);
	});

	it('stopAfter is scoped per-transaction, not global', () => {
		const stopper: Predicate = { kind: 'field', field: 'counterparty', op: 'equals', value: 'Stopper Inc' };
		const first = makeRule({ id: 'first', order: 0, predicate: stopper, assign: ['a'], stopAfter: true });
		const second = makeRule({ id: 'second', order: 1, assign: ['b'] });

		const stoppedTx = makeTx({ contentHash: 'stopped', counterparty: 'Stopper Inc' });
		const otherTx = makeTx({ contentHash: 'other', counterparty: 'Someone Else' });

		const assignments = classify([stoppedTx, otherTx], [first, second]);

		expect(assignments).toEqual([
			{ txContentHash: 'stopped', groupId: 'a', source: 'rule', ruleId: 'first' },
			{ txContentHash: 'other', groupId: 'b', source: 'rule', ruleId: 'second' }
		]);
	});
});
