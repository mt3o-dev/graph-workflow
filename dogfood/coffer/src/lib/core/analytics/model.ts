/**
 * Analytics domain types (coffer-analytics slice 3, P1, [dec:2] core purity).
 *
 * Pure TS only — no `node:` imports, no runtime libraries (boundary-lint
 * enforces this for everything under src/lib/core/**). These are DATA
 * shapes, not chart components ([dec:9]) — no d3/layerchart import here or
 * anywhere else under core/**. bigint->JSON serialization for the HTTP
 * boundary is a later slice's concern (noted in plan.md non-goals).
 */

/** Time-bucketing granularity for a series. */
export type Granularity = 'day' | 'week' | 'month';

/**
 * How a (transaction, group) pairing counts toward a group-aggregated
 * series ([node:bc0ab42f]).
 *
 * - `overlap`: each matched group counts the FULL tx amount. Cross-group
 *   totals may legitimately exceed the grand total — this is expected and
 *   MUST be labeled, never silently summed as if it were exhaustive.
 * - `partition`: each tx amount is attributed exactly ONCE across its
 *   matched groups (primary-else-even resolution, see attribution.ts).
 *   Partition sums reconcile EXACTLY to the grand total.
 */
export type AttributionMode = 'overlap' | 'partition';

/** One bucketed value on a series: `bucket` is the ISO date (YYYY-MM-DD) of the bucket's START. */
export interface Point {
	readonly bucket: string;
	readonly value: bigint;
}

/**
 * One labeled line of a chart: every group-aggregated series carries its
 * `mode` so a consumer can never mistake an overlap series for an exact
 * partition (or vice versa).
 */
export interface Series {
	readonly id: string;
	readonly label: string;
	readonly mode: AttributionMode;
	readonly currency: string;
	readonly points: readonly Point[];
}

/** A prepared, ready-to-render (but NOT rendered — [dec:9]) set of series for one currency. */
export interface SeriesSet {
	readonly series: readonly Series[];
	readonly grandTotalMinor: bigint;
	readonly currency: string;
}
