/**
 * UI DTOs — the JSON-safe shapes that cross the `load()`/action → client
 * boundary (coffer-ui-i18n slice 4, P3, [node:f36237e4]).
 *
 * SvelteKit's `devalue` serializer cannot carry `bigint` across the
 * server/client boundary. THE RULE (stated once, binding for every mapper in
 * `serialize.ts`): every `bigint` minor-unit amount becomes a decimal
 * **string** here — NEVER `Number` — because a naive `Number(bigint)`
 * conversion is lossy above `Number.MAX_SAFE_INTEGER` and silently drops
 * precision on ordinary large ledgers. The client re-parses the string to a
 * `Number` only at the final chart/format edge (personal-finance magnitudes
 * stay well under `MAX_SAFE_INTEGER`), per [node:f36237e4]. ISO date/bucket
 * strings already are JSON-safe and pass through unchanged.
 *
 * This file is server land (`src/lib/server/**`, not `src/lib/core/**`), so
 * boundary-lint does not scan it — importing core types for shape re-use is
 * fine. No adapters, no `node:` builtins needed here though; kept pure types
 * + tiny discriminated unions on purpose so it stays trivially testable.
 */
import type { AttributionMode, Granularity } from '../../core/analytics/model.js';
import type { GroupKind } from '../../core/model/group.js';
import type { AssignmentSource } from '../../core/model/assignment.js';

/** `Money` with `minor: bigint` replaced by a decimal string. */
export interface MoneyDto {
	readonly minor: string;
	readonly currency: string;
}

/** `Point` with `value: bigint` replaced by a decimal string. */
export interface PointDto {
	readonly bucket: string;
	readonly value: string;
}

/** `Series` with every `Point` mapped to `PointDto`. */
export interface SeriesDto {
	readonly id: string;
	readonly label: string;
	readonly mode: AttributionMode;
	readonly currency: string;
	readonly points: readonly PointDto[];
}

/** `SeriesSet` with `grandTotalMinor: bigint` replaced by a decimal string. */
export interface SeriesSetDto {
	readonly series: readonly SeriesDto[];
	readonly grandTotalMinor: string;
	readonly currency: string;
}

/** `Transaction` with `amount: Money` replaced by `MoneyDto`. Dates pass through (already ISO strings). */
export interface TransactionDto {
	readonly bookingDate: string;
	readonly valueDate: string;
	readonly amount: MoneyDto;
	readonly direction: 'in' | 'out';
	readonly counterparty: string;
	readonly description: string;
	readonly sourceAccount: string;
	readonly importBatchId: string;
	readonly contentHash: string;
}

/** `Group` is already JSON-safe (no bigint) — re-declared here so UI code depends on the DTO surface, not core, at the boundary. */
export interface GroupDto {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly kind: GroupKind;
}

/**
 * `Predicate` with every `bigint`/`[bigint,bigint]` amount value replaced by
 * a decimal string / string tuple. Structurally mirrors
 * `core/model/rule.ts`'s discriminated union one level deep.
 */
export type StringOp = 'equals' | 'contains';
export type AmountCompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface StringFieldPredicateDto {
	readonly kind: 'field';
	readonly field: 'description' | 'counterparty' | 'account';
	readonly op: StringOp;
	readonly value: string;
}

export interface AmountComparePredicateDto {
	readonly kind: 'field';
	readonly field: 'amount';
	readonly op: AmountCompareOp;
	readonly value: string;
}

export interface AmountBetweenPredicateDto {
	readonly kind: 'field';
	readonly field: 'amount';
	readonly op: 'between';
	readonly value: readonly [string, string];
}

export type FieldPredicateDto = StringFieldPredicateDto | AmountComparePredicateDto | AmountBetweenPredicateDto;

export interface AllPredicateDto {
	readonly kind: 'all';
	readonly predicates: readonly PredicateDto[];
}

export interface AnyPredicateDto {
	readonly kind: 'any';
	readonly predicates: readonly PredicateDto[];
}

export type PredicateDto = FieldPredicateDto | AllPredicateDto | AnyPredicateDto;

/** `Rule` with its `predicate` tree mapped to `PredicateDto`. */
export interface RuleDto {
	readonly id: string;
	readonly name?: string;
	readonly order: number;
	readonly predicate: PredicateDto;
	readonly assign: readonly string[];
	readonly stopAfter?: boolean;
}

/** `Assignment` is already JSON-safe — re-declared at the DTO surface for the same reason as `GroupDto`. */
export interface AssignmentDto {
	readonly txContentHash: string;
	readonly groupId: string;
	readonly source: AssignmentSource;
	readonly ruleId?: string;
}

/** `Suggestion` is already JSON-safe (no bigint). */
export interface SuggestionDto {
	readonly groupId: string;
	readonly confidence: number;
	readonly reason: string;
}

/** `SaveResult` is already JSON-safe (no bigint). */
export interface SaveResultDto {
	readonly batchId: string;
	readonly inserted: number;
	readonly duplicates: number;
}

/** Re-exported for DTO consumers that need the granularity/mode enums without importing core directly. */
export type { AttributionMode, Granularity };
