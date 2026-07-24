/**
 * Prepared `SeriesSet` DTO assembly (coffer-analytics slice 3, P4). Joins
 * `cashflowByCurrency` + `attribute`/`byGroupRollup`/`byGroupSelf` into the
 * `core/analytics/model.ts` shapes a slice-4 UI consumes as DATA — no
 * rendering, no d3/layerchart import ([dec:9]).
 *
 * Pure TS only, zero I/O — the join against ports/adapters happens in
 * `Container.analytics()`, not here.
 */
import type { Transaction } from '../model/transaction.js';
import type { Assignment } from '../model/assignment.js';
import type { Group } from '../model/group.js';
import type { AttributionMode, Granularity, Series, SeriesSet } from './model.js';
import { cashflowByCurrency, type CashflowFilter } from './cashflow.js';
import { attribute, type PrimaryGroupOf } from './attribution.js';
import { byGroupRollup, byGroupSelf, type RollupVariant } from './by-group.js';

/** Assemble the income/outcome/net cashflow SeriesSets, one per currency. */
export function cashflowSeriesSets(
	txns: readonly Transaction[],
	granularity: Granularity,
	filter?: CashflowFilter
): SeriesSet[] {
	const perCurrency = cashflowByCurrency(txns, granularity, filter);

	return perCurrency.map((cf) => {
		const grandTotalMinor = cf.income.reduce((acc, p) => acc + p.value, 0n) - cf.outcome.reduce((acc, p) => acc + p.value, 0n);
		const series: Series[] = [
			{ id: 'income', label: 'Income', mode: 'overlap', currency: cf.currency, points: cf.income },
			{ id: 'outcome', label: 'Outcome', mode: 'overlap', currency: cf.currency, points: cf.outcome },
			{ id: 'net', label: 'Net', mode: 'overlap', currency: cf.currency, points: cf.net }
		];
		return { series, grandTotalMinor, currency: cf.currency };
	});
}

export interface ByGroupOptions {
	readonly mode: AttributionMode;
	readonly variant: RollupVariant;
	readonly primaryGroupOf?: PrimaryGroupOf;
}

/**
 * Synthetic series id for transactions with zero group assignments. Being
 * unclassified is a NORMAL state (the review queue is exactly that set), so
 * partition reconciliation must account for it explicitly rather than let the
 * series silently stop summing to the grand total.
 */
export const UNCLASSIFIED_GROUP_ID = '__unclassified__';

/**
 * Assemble by-group SeriesSets (one per currency): each `Series` is a
 * single-point-per-currency-per-group total, labeled by group id, `mode`,
 * and `variant`. `grandTotalMinor` is the sum of every transaction's amount
 * for that currency (independent of mode/variant). Transactions with zero
 * assignments appear under the synthetic {@link UNCLASSIFIED_GROUP_ID} series
 * in BOTH modes — so a `partition` `SeriesSet`'s series sum EXACTLY to
 * `grandTotalMinor` even when unclassified transactions exist, while an
 * `overlap` one may exceed it (expected, per the mode label on each series).
 * [review rework: resolves the reconciliation gap flagged as node bdfeb7e7.]
 */
export function byGroupSeriesSets(
	txns: readonly Transaction[],
	assignments: readonly Assignment[],
	groups: readonly Group[],
	opts: ByGroupOptions
): SeriesSet[] {
	const rows = attribute(txns, assignments, { mode: opts.mode, primaryGroupOf: opts.primaryGroupOf });
	const totals =
		opts.variant === 'self' ? byGroupSelf(rows, opts.mode) : byGroupRollup(rows, txns, groups, opts.mode);

	const grandTotalByCurrency = new Map<string, bigint>();
	for (const tx of txns) {
		grandTotalByCurrency.set(
			tx.amount.currency,
			(grandTotalByCurrency.get(tx.amount.currency) ?? 0n) + tx.amount.minor
		);
	}

	// Unclassified residue per currency: attribute() yields zero rows for a tx
	// with no assignments, so sum those transactions directly.
	const assignedHashes = new Set(assignments.map((a) => a.txContentHash));
	const unclassifiedByCurrency = new Map<string, bigint>();
	for (const tx of txns) {
		if (!assignedHashes.has(tx.contentHash)) {
			unclassifiedByCurrency.set(
				tx.amount.currency,
				(unclassifiedByCurrency.get(tx.amount.currency) ?? 0n) + tx.amount.minor
			);
		}
	}

	const currencies = new Set<string>([...totals.map((t) => t.currency), ...grandTotalByCurrency.keys()]);
	const groupNameById = new Map(groups.map((g) => [g.id, g.name] as const));

	const result: SeriesSet[] = [];
	for (const currency of currencies) {
		const series: Series[] = totals
			.filter((t) => t.currency === currency)
			.map((t) => ({
				id: t.groupId,
				label: groupNameById.get(t.groupId) ?? t.groupId,
				mode: t.mode,
				currency: t.currency,
				points: [{ bucket: 'total', value: t.amountMinor }]
			}));
		const unclassified = unclassifiedByCurrency.get(currency);
		if (unclassified !== undefined) {
			series.push({
				id: UNCLASSIFIED_GROUP_ID,
				label: 'Unclassified',
				mode: opts.mode,
				currency,
				points: [{ bucket: 'total', value: unclassified }]
			});
		}
		result.push({ series, grandTotalMinor: grandTotalByCurrency.get(currency) ?? 0n, currency });
	}
	return result;
}
