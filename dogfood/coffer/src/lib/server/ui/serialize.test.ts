/**
 * DTO mapper tests (coffer-ui-i18n slice 4, P3). Every mapper round-trips
 * exactly (string -> bigint -> string), the unclassified series survives
 * `toSeriesSetDto`, and a `JSON.stringify` smoke test proves no `bigint`
 * ever leaks into a serialized payload ([node:f36237e4] — devalue cannot
 * carry `bigint` across the SvelteKit load boundary).
 */
import { describe, expect, it } from 'vitest';
import { byGroupSeriesSets, cashflowSeriesSets, UNCLASSIFIED_GROUP_ID } from '../../core/analytics/series.js';
import type { Transaction } from '../../core/model/transaction.js';
import type { Group } from '../../core/model/group.js';
import type { Assignment } from '../../core/model/assignment.js';
import type { Rule } from '../../core/model/rule.js';
import {
	fromMoneyDto,
	fromPredicateDto,
	fromTransactionDto,
	minorToString,
	stringToMinor,
	toGroupDto,
	toMoneyDto,
	toPredicateDto,
	toRuleDto,
	toSaveResultDto,
	toSeriesSetDto,
	toSeriesSetDtos,
	toSuggestionDto,
	toTransactionDto
} from './serialize.js';

/** Recursively assert nothing in `value` is a `bigint`. */
function assertNoBigint(value: unknown, path = '$'): void {
	if (typeof value === 'bigint') {
		throw new Error(`bigint leaked at ${path}`);
	}
	if (Array.isArray(value)) {
		value.forEach((v, i) => assertNoBigint(v, `${path}[${i}]`));
	} else if (value !== null && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) {
			assertNoBigint(v, `${path}.${k}`);
		}
	}
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-07-01',
		valueDate: '2026-07-01',
		amount: { minor: 12345678901234n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'ACME',
		description: 'Groceries',
		sourceAccount: 'PL00',
		importBatchId: 'b1',
		contentHash: 'tx1',
		...overrides
	};
}

describe('minorToString / stringToMinor', () => {
	it('round-trips exactly for large, negative, and zero values', () => {
		for (const v of [0n, 1n, -1n, 12345678901234567890n, -12345678901234567890n, 9007199254740993n]) {
			expect(stringToMinor(minorToString(v))).toBe(v);
		}
	});

	it('rejects a non-integer decimal string', () => {
		expect(() => stringToMinor('12.34')).toThrow();
		expect(() => stringToMinor('abc')).toThrow();
		expect(() => stringToMinor('')).toThrow();
	});
});

describe('MoneyDto round trip', () => {
	it('toMoneyDto/fromMoneyDto is exact for a value beyond Number.MAX_SAFE_INTEGER', () => {
		const money = { minor: 90071992547409999999n, currency: 'PLN' };
		const dto = toMoneyDto(money);
		expect(typeof dto.minor).toBe('string');
		expect(fromMoneyDto(dto)).toEqual(money);
	});
});

describe('TransactionDto round trip', () => {
	it('toTransactionDto/fromTransactionDto is exact and JSON-safe', () => {
		const t = tx();
		const dto = toTransactionDto(t);
		assertNoBigint(dto);
		expect(fromTransactionDto(dto)).toEqual(t);
		// JSON.stringify smoke: must not throw "Do not know how to serialize a BigInt".
		expect(() => JSON.stringify(dto)).not.toThrow();
	});
});

describe('SeriesSet -> SeriesSetDto', () => {
	it('maps cashflowSeriesSets with no bigint leaks and exact point round trip', () => {
		const txns = [tx({ contentHash: 'tx1', amount: { minor: 1000n, currency: 'PLN' }, direction: 'in' })];
		const [set] = cashflowSeriesSets(txns, 'day');
		const dto = toSeriesSetDto(set);

		assertNoBigint(dto);
		expect(() => JSON.stringify(dto)).not.toThrow();
		expect(dto.grandTotalMinor).toBe(minorToString(set.grandTotalMinor));
		for (const [i, series] of set.series.entries()) {
			for (const [j, point] of series.points.entries()) {
				expect(dto.series[i].points[j].value).toBe(minorToString(point.value));
				expect(stringToMinor(dto.series[i].points[j].value)).toBe(point.value);
			}
		}
	});

	it('carries the unclassified series through byGroupSeriesSets -> DTO, and partition series sum to grandTotalMinor', () => {
		const txns = [
			tx({ contentHash: 'tx1', amount: { minor: -400n, currency: 'PLN' } }),
			tx({ contentHash: 'tx2', amount: { minor: -100n, currency: 'PLN' } }) // left unassigned -> unclassified
		];
		const groups: Group[] = [{ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' }];
		const assignments: Assignment[] = [{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }];
		const [set] = byGroupSeriesSets(txns, assignments, groups, { mode: 'partition', variant: 'self' });
		const dto = toSeriesSetDto(set);

		assertNoBigint(dto);
		const unclassified = dto.series.find((s) => s.id === UNCLASSIFIED_GROUP_ID);
		expect(unclassified).toBeDefined();
		expect(unclassified?.points[0].value).toBe('-100');

		const sum = dto.series.reduce((acc, s) => acc + stringToMinor(s.points[0].value), 0n);
		expect(sum).toBe(stringToMinor(dto.grandTotalMinor));
	});

	it('toSeriesSetDtos maps an array and stays JSON-safe end to end', () => {
		const txns = [tx({ contentHash: 'tx1', amount: { minor: 500n, currency: 'PLN' }, direction: 'in' })];
		const sets = cashflowSeriesSets(txns, 'day');
		const dtos = toSeriesSetDtos(sets);
		assertNoBigint(dtos);
		expect(() => JSON.stringify(dtos)).not.toThrow();
	});
});

describe('GroupDto / SuggestionDto / SaveResultDto passthrough', () => {
	it('toGroupDto is a JSON-safe passthrough', () => {
		const group: Group = { id: 'g1', name: 'Rent', parentId: null, kind: 'group' };
		expect(toGroupDto(group)).toEqual(group);
	});

	it('toSuggestionDto is a JSON-safe passthrough', () => {
		const suggestion = { groupId: 'g1', confidence: 0.8, reason: 'seen before' };
		expect(toSuggestionDto(suggestion)).toEqual(suggestion);
	});

	it('toSaveResultDto is a JSON-safe passthrough', () => {
		const result = { batchId: 'b1', inserted: 2, duplicates: 1 };
		expect(toSaveResultDto(result)).toEqual(result);
	});
});

describe('RuleDto / PredicateDto round trip', () => {
	it('maps a nested predicate tree with amount bigints to strings and back exactly', () => {
		const rule: Rule = {
			id: 'r1',
			name: 'Big groceries',
			order: 0,
			predicate: {
				kind: 'all',
				predicates: [
					{ kind: 'field', field: 'description', op: 'contains', value: 'grocery' },
					{ kind: 'field', field: 'amount', op: 'between', value: [-100000n, -100n] },
					{
						kind: 'any',
						predicates: [{ kind: 'field', field: 'amount', op: 'lt', value: -50000n }]
					}
				]
			},
			assign: ['g1'],
			stopAfter: true
		};

		const dto = toRuleDto(rule);
		assertNoBigint(dto);
		expect(() => JSON.stringify(dto)).not.toThrow();
		expect(fromPredicateDto(dto.predicate)).toEqual(rule.predicate);
	});

	it('round trips a single amount-compare predicate', () => {
		const predicate = { kind: 'field' as const, field: 'amount' as const, op: 'eq' as const, value: -12345678901234n };
		const dto = toPredicateDto(predicate);
		assertNoBigint(dto);
		expect(fromPredicateDto(dto)).toEqual(predicate);
	});
});
