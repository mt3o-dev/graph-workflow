/**
 * Typed load/action helpers — THE CONTRACT `src/routes/**\/+page.server.ts`
 * (P4) imports from (coffer-ui-i18n slice 4, P3). Every function here takes
 * a `Container` explicitly (never reaches for the singleton itself, see
 * `container-singleton.ts`), calls exactly the `Container` methods listed in
 * the plan (`analytics()`, `classify()`, `reviewQueue()`, `assign()`,
 * `promoteToRule()`, `suggest()`, `importStatement`/`importPdf`, store
 * reads), and returns a JSON-safe DTO built through `serialize.ts` — no
 * `bigint` ever reaches a `load()` return value.
 *
 * A P4 `+page.server.ts` calls `getContainer()` once and passes it in, e.g.:
 *
 *   export async function load() {
 *     const container = await getContainer();
 *     return { dashboard: await loadDashboardData(container, { granularity: 'month' }) };
 *   }
 */
import type { Container } from '../container.js';
import type { CashflowFilter } from '../../core/analytics/cashflow.js';
import type { ByGroupOptions } from '../../core/analytics/series.js';
import type { Granularity } from '../../core/analytics/model.js';
import type { ParseContext } from '../../ports/statement-parser.port.js';
import type {
	GroupDto,
	RuleDto,
	SaveResultDto,
	SeriesSetDto,
	SuggestionDto,
	TransactionDto
} from './dto.js';
import {
	fromTransactionDto,
	toGroupDtos,
	toRuleDtos,
	toSaveResultDto,
	toSeriesSetDtos,
	toSuggestionDtos,
	toTransactionDtos
} from './serialize.js';

/** Options for `loadDashboardData` — mirrors `Container.analytics()`'s two option bags. */
export interface DashboardFilters {
	readonly granularity: Granularity;
	readonly filter?: CashflowFilter;
	readonly byGroup?: ByGroupOptions;
}

export interface DashboardDataDto {
	readonly cashflow: SeriesSetDto[];
	readonly byGroup?: SeriesSetDto[];
}

/**
 * Dashboard screen data: cashflow SeriesSets, plus by-group SeriesSets when
 * `filters.byGroup` is passed (the unclassified series is present in that
 * result whenever any transaction has zero assignments, per
 * `byGroupSeriesSets`/[node:0b08fbef] — this loader does not filter it out).
 */
export async function loadDashboardData(
	container: Container,
	filters: DashboardFilters
): Promise<DashboardDataDto> {
	const { cashflow, byGroup } = await container.analytics(
		{ granularity: filters.granularity, filter: filters.filter },
		filters.byGroup
	);
	return {
		cashflow: toSeriesSetDtos(cashflow),
		...(byGroup !== undefined ? { byGroup: toSeriesSetDtos(byGroup) } : {})
	};
}

export interface ImportScreenDataDto {
	/** Parser ids enabled by `config.import.enabledParsers` ([dec:11]) — drives which format hints the import screen shows. */
	readonly enabledParserIds: readonly string[];
}

/** Import screen data: which parsers are enabled, so the screen can hint accepted formats. */
export async function loadImportScreen(container: Container): Promise<ImportScreenDataDto> {
	return { enabledParserIds: container.parsers.map((p) => p.id) };
}

export type PerformImportInput =
	| { readonly kind: 'text'; readonly payload: string; readonly ctx: ParseContext; readonly sourceLabel: string }
	| { readonly kind: 'pdf'; readonly bytes: Uint8Array; readonly ctx: ParseContext; readonly sourceLabel: string };

/** Run an import (text/CSV/OFX or PDF) through `Container.importStatement`/`importPdf` and return a JSON-safe `SaveResultDto`. */
export async function performImport(container: Container, input: PerformImportInput): Promise<SaveResultDto> {
	const result =
		input.kind === 'text'
			? await container.importStatement({ payload: input.payload, ctx: input.ctx, sourceLabel: input.sourceLabel })
			: await container.importPdf({ bytes: input.bytes, ctx: input.ctx, sourceLabel: input.sourceLabel });
	return toSaveResultDto(result);
}

/** The review-queue screen's data: unassigned transactions, JSON-safe. */
export async function loadReviewQueue(container: Container): Promise<TransactionDto[]> {
	const txns = await container.reviewQueue();
	return toTransactionDtos(txns);
}

/**
 * Commit a manual correction: `txDto` is round-tripped back to a domain
 * `Transaction` (the review-queue screen echoes back the DTO it was handed —
 * this is the one place a `TransactionDto` flows client -> server) before
 * calling `Container.assign`.
 */
export async function performAssign(container: Container, txDto: TransactionDto, groupIds: readonly string[]): Promise<void> {
	await container.assign(fromTransactionDto(txDto), groupIds);
}

export interface PerformPromoteRuleOptions {
	readonly id?: string;
	readonly order?: number;
	readonly name?: string;
	readonly stopAfter?: boolean;
}

/** Promote a manual correction on `txDto` to a reusable rule. Returns the JSON-safe `RuleDto` (amount predicates, if any, as decimal strings). */
export async function performPromoteRule(
	container: Container,
	txDto: TransactionDto,
	groupIds: readonly string[],
	opts: PerformPromoteRuleOptions = {}
): Promise<RuleDto> {
	const rule = await container.promoteToRule(fromTransactionDto(txDto), groupIds, opts);
	return toRuleDtos([rule])[0];
}

/** Categorization suggestions for `txDto` ([dec:9117c159]) — `[]` when `assist.enabled` is off, same as `Container.suggest`. */
export async function performSuggest(container: Container, txDto: TransactionDto): Promise<SuggestionDto[]> {
	const suggestions = await container.suggest(fromTransactionDto(txDto));
	return toSuggestionDtos(suggestions);
}

export interface SettingsDataDto {
	readonly groups: GroupDto[];
	readonly rules: RuleDto[];
}

/** Settings screen data: every stored group and rule, JSON-safe (rule amount predicates as decimal strings). */
export async function loadSettings(container: Container): Promise<SettingsDataDto> {
	const [groups, rules] = await Promise.all([
		container.classificationStore.listGroups(),
		container.classificationStore.listRules()
	]);
	return { groups: toGroupDtos(groups), rules: toRuleDtos(rules) };
}
