/**
 * Domain model: Transaction + Money ([dec:2] core purity, [dec:5] dedup input
 * shape, PRD FR2 normalization schema).
 *
 * Pure TS only — no `node:` imports, no runtime libraries. Money never holds a
 * float: amounts are integer minor units (bigint) end to end to avoid drift
 * (plan.md Phase 2 risk note).
 */

/** 'in' | 'out', derived from the sign of Money.minor — never stored as an
 *  independent, contradictable field. Zero is treated as 'in' by convention. */
export type Direction = 'in' | 'out';

/** An amount in integer minor units (e.g. cents) + its ISO 4217 currency code. */
export interface Money {
	readonly minor: bigint;
	readonly currency: string;
}

/**
 * Construct a Money value. `minor` may be passed as bigint or a safe integer
 * number for caller convenience; currency is upper-cased (ISO 4217 codes are
 * conventionally upper-case, e.g. "PLN", "USD").
 */
export function money(minor: bigint | number, currency: string): Money {
	if (typeof minor === 'number' && !Number.isInteger(minor)) {
		throw new Error(`Money.minor must be an integer, got ${minor}`);
	}
	return {
		minor: typeof minor === 'bigint' ? minor : BigInt(minor),
		currency: currency.toUpperCase()
	};
}

/** Add two Money values. Throws on currency mismatch — no implicit conversion. */
export function addMoney(a: Money, b: Money): Money {
	if (a.currency !== b.currency) {
		throw new Error(`Money.add: currency mismatch (${a.currency} vs ${b.currency})`);
	}
	return { minor: a.minor + b.minor, currency: a.currency };
}

/** Negate a Money value (flips sign, keeps currency). */
export function negateMoney(a: Money): Money {
	return { minor: -a.minor, currency: a.currency };
}

/** Derive the transaction direction from the amount's sign. Zero is 'in'. */
export function directionOf(amount: Money): Direction {
	return amount.minor < 0n ? 'out' : 'in';
}

/**
 * Format-agnostic decimal rendering of a Money value: minor units divided by
 * 10^minorDigits, rendered as a plain "-?D+.DD" string — NO locale, NO
 * currency symbol, NO thousands separators. This is a debugging/interchange
 * helper, not a display formatter; display formatting (locale-aware, symbol-
 * aware) belongs to an adapter/UI layer, not core.
 *
 * `minorDigits` defaults to 2 (the common case — cents-like currencies).
 * Zero-decimal currencies (e.g. JPY) should pass `minorDigits: 0` explicitly;
 * core does not maintain a currency → decimal-places table (that table, if
 * ever needed, belongs behind a port, not hardcoded here).
 */
export function formatMoney(amount: Money, minorDigits = 2): string {
	if (!Number.isInteger(minorDigits) || minorDigits < 0) {
		throw new Error(`formatMoney: minorDigits must be a non-negative integer, got ${minorDigits}`);
	}
	const negative = amount.minor < 0n;
	const abs = negative ? -amount.minor : amount.minor;
	if (minorDigits === 0) {
		return `${negative ? '-' : ''}${abs.toString()}`;
	}
	const scale = 10n ** BigInt(minorDigits);
	const major = abs / scale;
	const fraction = (abs % scale).toString().padStart(minorDigits, '0');
	return `${negative ? '-' : ''}${major.toString()}.${fraction}`;
}

/**
 * A parser's raw output, before normalization: what any StatementParserPort
 * adapter (PDF/CSV/OFX, all in future phases) produces. Deliberately lacks
 * `direction`, `importBatchId`, and `contentHash` — those are derived by
 * `normalizeTransaction` (normalize.ts), not by parsers.
 */
export interface ParsedRow {
	/** ISO 8601 date, e.g. "2026-07-19". */
	readonly bookingDate: string;
	/** ISO 8601 date; may equal bookingDate. */
	readonly valueDate: string;
	readonly amount: Money;
	readonly counterparty: string;
	/** Raw, unmodified description text — kept as-is for display. */
	readonly description: string;
	readonly sourceAccount: string;
}

/**
 * The normalized domain record every later phase (store, pipeline, UI)
 * consumes. `description` is the untouched display text; the hash-only
 * normalized form is never stored here (see normalize.ts / hash.ts).
 */
export interface Transaction {
	readonly bookingDate: string;
	readonly valueDate: string;
	readonly amount: Money;
	readonly direction: Direction;
	readonly counterparty: string;
	readonly description: string;
	readonly sourceAccount: string;
	readonly importBatchId: string;
	readonly contentHash: string;
}
