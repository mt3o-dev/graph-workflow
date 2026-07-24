/**
 * Income/outcome-over-time cashflow series (coffer-analytics slice 3, P2).
 *
 * Pure TS only, zero I/O — takes the full transaction array and returns
 * bucketed per-currency series. `directionOf` (transaction.ts) derives
 * direction from the amount's sign; this module never re-derives it. All
 * arithmetic is on `Money.minor` (bigint) — never `number` on amounts.
 */
import type { Transaction } from '../model/transaction.js';
import { directionOf } from '../model/transaction.js';
import type { Granularity } from './model.js';
import { bucketOf } from './buckets.js';

/** Optional filters applied before bucketing. */
export interface CashflowFilter {
	/** Inclusive lower bound on `bookingDate` (ISO "YYYY-MM-DD" or datetime prefix). */
	readonly fromDate?: string;
	/** Inclusive upper bound on `bookingDate`. */
	readonly toDate?: string;
	/** Restrict to these source accounts, if given. */
	readonly sourceAccounts?: readonly string[];
}

/** One currency's cashflow-over-time: income, outcome (both non-negative minor units), and net. */
export interface CashflowSeries {
	readonly currency: string;
	readonly granularity: Granularity;
	/** Bucket-sorted (ascending). Income is the sum of 'in' amounts per bucket, always >= 0. */
	readonly income: readonly { bucket: string; value: bigint }[];
	/** Bucket-sorted (ascending). Outcome is the ABSOLUTE VALUE of 'out' amounts per bucket, always >= 0. */
	readonly outcome: readonly { bucket: string; value: bigint }[];
	/** Bucket-sorted (ascending). Net = income - outcome per bucket (may be negative). */
	readonly net: readonly { bucket: string; value: bigint }[];
}

function passesFilter(tx: Transaction, filter: CashflowFilter | undefined): boolean {
	if (!filter) {
		return true;
	}
	if (filter.fromDate !== undefined && tx.bookingDate < filter.fromDate) {
		return false;
	}
	if (filter.toDate !== undefined && tx.bookingDate > filter.toDate) {
		return false;
	}
	if (filter.sourceAccounts !== undefined && !filter.sourceAccounts.includes(tx.sourceAccount)) {
		return false;
	}
	return true;
}

/** Sort a Map<bucket, bigint> into an ascending-by-bucket array of points. */
function toSortedPoints(byBucket: Map<string, bigint>): { bucket: string; value: bigint }[] {
	return Array.from(byBucket.entries())
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([bucket, value]) => ({ bucket, value }));
}

/**
 * Compute income/outcome/net cashflow series, one `CashflowSeries` per
 * currency present in the (filtered) transaction set. No FX — amounts of
 * different currencies are never summed together ([dec:8] accepted gap).
 */
export function cashflowByCurrency(
	txns: readonly Transaction[],
	granularity: Granularity,
	filter?: CashflowFilter
): CashflowSeries[] {
	const byCurrency = new Map<string, { income: Map<string, bigint>; outcome: Map<string, bigint> }>();

	for (const tx of txns) {
		if (!passesFilter(tx, filter)) {
			continue;
		}
		const currency = tx.amount.currency;
		let entry = byCurrency.get(currency);
		if (!entry) {
			entry = { income: new Map(), outcome: new Map() };
			byCurrency.set(currency, entry);
		}
		const bucket = bucketOf(tx.bookingDate, granularity);
		const direction = directionOf(tx.amount);
		const target = direction === 'in' ? entry.income : entry.outcome;
		const magnitude = tx.amount.minor < 0n ? -tx.amount.minor : tx.amount.minor;
		target.set(bucket, (target.get(bucket) ?? 0n) + magnitude);
	}

	const result: CashflowSeries[] = [];
	for (const [currency, { income, outcome }] of Array.from(byCurrency.entries()).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0
	)) {
		const buckets = new Set<string>([...income.keys(), ...outcome.keys()]);
		const net = new Map<string, bigint>();
		for (const bucket of buckets) {
			net.set(bucket, (income.get(bucket) ?? 0n) - (outcome.get(bucket) ?? 0n));
		}
		result.push({
			currency,
			granularity,
			income: toSortedPoints(income),
			outcome: toSortedPoints(outcome),
			net: toSortedPoints(net)
		});
	}
	return result;
}
