/**
 * DTO mappers — the `load()`/action → client serialization boundary
 * (coffer-ui-i18n slice 4, P3, [node:f36237e4]).
 *
 * THE RULE, stated once (see `dto.ts` for the full rationale): every
 * `bigint` minor-unit amount crosses this boundary as a decimal **string**,
 * never `Number` — `minorToString`/`stringToMinor` are the only two
 * functions allowed to convert between the two, and every mapper below is
 * built on top of them. Every mapper here is a pure, total, round-trippable
 * function: `stringToMinor(minorToString(x)) === x` for every representable
 * `bigint`, and every `to*Dto` has a `from*Dto` inverse where the UI needs to
 * send data back (assign/promote-rule actions echo a `TransactionDto` the
 * server must turn back into a domain `Transaction`).
 */
import type { Point, Series, SeriesSet } from '../../core/analytics/model.js';
import type { Money, Transaction } from '../../core/model/transaction.js';
import type { Group } from '../../core/model/group.js';
import type { Assignment } from '../../core/model/assignment.js';
import type { Predicate, Rule } from '../../core/model/rule.js';
import type { Suggestion } from '../../ports/assist.port.js';
import type { SaveResult } from '../../ports/store.port.js';
import type {
	AssignmentDto,
	GroupDto,
	MoneyDto,
	PointDto,
	PredicateDto,
	RuleDto,
	SaveResultDto,
	SeriesDto,
	SeriesSetDto,
	SuggestionDto,
	TransactionDto
} from './dto.js';

/** `bigint` minor units -> decimal string. The ONE place that stringifies a minor-unit amount. */
export function minorToString(minor: bigint): string {
	return minor.toString();
}

/**
 * Decimal string -> `bigint` minor units. The ONE place that parses a
 * minor-unit amount back out of a string. Throws on anything that isn't an
 * optionally-signed run of digits (never silently truncates/rounds — that's
 * the whole point of staying off `Number` at this boundary).
 */
export function stringToMinor(value: string): bigint {
	if (!/^-?\d+$/.test(value)) {
		throw new Error(`stringToMinor: not an integer decimal string: ${JSON.stringify(value)}`);
	}
	return BigInt(value);
}

export function toMoneyDto(money: Money): MoneyDto {
	return { minor: minorToString(money.minor), currency: money.currency };
}

export function fromMoneyDto(dto: MoneyDto): Money {
	return { minor: stringToMinor(dto.minor), currency: dto.currency };
}

export function toPointDto(point: Point): PointDto {
	return { bucket: point.bucket, value: minorToString(point.value) };
}

export function fromPointDto(dto: PointDto): Point {
	return { bucket: dto.bucket, value: stringToMinor(dto.value) };
}

export function toSeriesDto(series: Series): SeriesDto {
	return {
		id: series.id,
		label: series.label,
		mode: series.mode,
		currency: series.currency,
		points: series.points.map(toPointDto)
	};
}

export function toSeriesSetDto(set: SeriesSet): SeriesSetDto {
	return {
		series: set.series.map(toSeriesDto),
		grandTotalMinor: minorToString(set.grandTotalMinor),
		currency: set.currency
	};
}

export function toSeriesSetDtos(sets: readonly SeriesSet[]): SeriesSetDto[] {
	return sets.map(toSeriesSetDto);
}

export function toTransactionDto(tx: Transaction): TransactionDto {
	return {
		bookingDate: tx.bookingDate,
		valueDate: tx.valueDate,
		amount: toMoneyDto(tx.amount),
		direction: tx.direction,
		counterparty: tx.counterparty,
		description: tx.description,
		sourceAccount: tx.sourceAccount,
		importBatchId: tx.importBatchId,
		contentHash: tx.contentHash
	};
}

export function fromTransactionDto(dto: TransactionDto): Transaction {
	return {
		bookingDate: dto.bookingDate,
		valueDate: dto.valueDate,
		amount: fromMoneyDto(dto.amount),
		direction: dto.direction,
		counterparty: dto.counterparty,
		description: dto.description,
		sourceAccount: dto.sourceAccount,
		importBatchId: dto.importBatchId,
		contentHash: dto.contentHash
	};
}

export function toTransactionDtos(txns: readonly Transaction[]): TransactionDto[] {
	return txns.map(toTransactionDto);
}

/** `Group` has no `bigint` field — passthrough, kept as a named mapper so callers depend on the DTO surface uniformly. */
export function toGroupDto(group: Group): GroupDto {
	return { id: group.id, name: group.name, parentId: group.parentId, kind: group.kind };
}

export function toGroupDtos(groups: readonly Group[]): GroupDto[] {
	return groups.map(toGroupDto);
}

/** `Assignment` has no `bigint` field — passthrough, named for the same uniformity reason as `toGroupDto`. */
export function toAssignmentDto(assignment: Assignment): AssignmentDto {
	return {
		txContentHash: assignment.txContentHash,
		groupId: assignment.groupId,
		source: assignment.source,
		...(assignment.ruleId !== undefined ? { ruleId: assignment.ruleId } : {})
	};
}

export function toAssignmentDtos(assignments: readonly Assignment[]): AssignmentDto[] {
	return assignments.map(toAssignmentDto);
}

/** Walks a `Predicate` tree, mapping every amount `bigint`/`[bigint,bigint]` leaf to a decimal string. */
export function toPredicateDto(predicate: Predicate): PredicateDto {
	switch (predicate.kind) {
		case 'field':
			if (predicate.field === 'amount') {
				return predicate.op === 'between'
					? {
							kind: 'field',
							field: 'amount',
							op: 'between',
							value: [minorToString(predicate.value[0]), minorToString(predicate.value[1])]
						}
					: { kind: 'field', field: 'amount', op: predicate.op, value: minorToString(predicate.value) };
			}
			return { kind: 'field', field: predicate.field, op: predicate.op, value: predicate.value };
		case 'all':
			return { kind: 'all', predicates: predicate.predicates.map(toPredicateDto) };
		case 'any':
			return { kind: 'any', predicates: predicate.predicates.map(toPredicateDto) };
	}
}

export function fromPredicateDto(dto: PredicateDto): Predicate {
	switch (dto.kind) {
		case 'field':
			if (dto.field === 'amount') {
				return dto.op === 'between'
					? {
							kind: 'field',
							field: 'amount',
							op: 'between',
							value: [stringToMinor(dto.value[0]), stringToMinor(dto.value[1])]
						}
					: { kind: 'field', field: 'amount', op: dto.op, value: stringToMinor(dto.value) };
			}
			return { kind: 'field', field: dto.field, op: dto.op, value: dto.value };
		case 'all':
			return { kind: 'all', predicates: dto.predicates.map(fromPredicateDto) };
		case 'any':
			return { kind: 'any', predicates: dto.predicates.map(fromPredicateDto) };
	}
}

export function toRuleDto(rule: Rule): RuleDto {
	return {
		id: rule.id,
		...(rule.name !== undefined ? { name: rule.name } : {}),
		order: rule.order,
		predicate: toPredicateDto(rule.predicate),
		assign: rule.assign,
		...(rule.stopAfter !== undefined ? { stopAfter: rule.stopAfter } : {})
	};
}

export function toRuleDtos(rules: readonly Rule[]): RuleDto[] {
	return rules.map(toRuleDto);
}

/** `Suggestion` has no `bigint` field — passthrough, named for the same uniformity reason as `toGroupDto`. */
export function toSuggestionDto(suggestion: Suggestion): SuggestionDto {
	return { groupId: suggestion.groupId, confidence: suggestion.confidence, reason: suggestion.reason };
}

export function toSuggestionDtos(suggestions: readonly Suggestion[]): SuggestionDto[] {
	return suggestions.map(toSuggestionDto);
}

/** `SaveResult` has no `bigint` field — passthrough, named for the same uniformity reason as `toGroupDto`. */
export function toSaveResultDto(result: SaveResult): SaveResultDto {
	return { batchId: result.batchId, inserted: result.inserted, duplicates: result.duplicates };
}
