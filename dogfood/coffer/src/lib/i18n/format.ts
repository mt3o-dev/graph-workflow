/**
 * The ONLY module in this codebase that touches `Intl` for display
 * formatting ([node:4f66243c]: core's `formatMoney` is a format-agnostic
 * decimal renderer, not a display formatter — locale-aware money/number/
 * date display formatting lives here, exclusively).
 *
 * Money inputs cross the `load()`→client boundary as decimal strings, never
 * `bigint` ([node:f36237e4], SvelteKit's devalue can't serialize `bigint`).
 * `formatMoney`/`formatDecimal` accept either a `bigint` (server-side, still
 * legal) or that minor-units string, and parse to `Number` only here, at the
 * display edge — personal-finance magnitudes stay well under
 * `Number.MAX_SAFE_INTEGER`, so the parse is exact.
 */
import type { Locale } from './t.js';

/** BCP-47 tag `Intl` actually resolves against for each supported locale.
 * Region-less `en`/`pl` and Node's default ICU already track this well, but
 * being explicit keeps currency-symbol placement stable across ICU builds. */
const INTL_TAG: Record<Locale, string> = {
	en: 'en-US',
	pl: 'pl-PL'
};

function toBigIntMinor(minorUnits: string | bigint): bigint {
	return typeof minorUnits === 'bigint' ? minorUnits : BigInt(minorUnits);
}

/**
 * Format an integer minor-units amount (e.g. cents) as locale- and
 * currency-aware money, e.g. `formatMoney('12345', 'USD', 'en')` ->
 * `"$123.45"`. `minorDigits` mirrors core's `formatMoney` default of 2
 * (cents-like currencies); pass 0 explicitly for zero-decimal currencies
 * (e.g. JPY) — this module never guesses it from the currency code.
 */
export function formatMoney(minorUnits: string | bigint, currency: string, locale: Locale, minorDigits = 2): string {
	if (!Number.isInteger(minorDigits) || minorDigits < 0) {
		throw new Error(`formatMoney: minorDigits must be a non-negative integer, got ${minorDigits}`);
	}
	const minor = toBigIntMinor(minorUnits);
	const scale = 10 ** minorDigits;
	// Magnitudes are guaranteed < Number.MAX_SAFE_INTEGER for personal-finance
	// data (plan [node:f36237e4]); the Number() conversion is exact here.
	const major = Number(minor) / scale;
	return new Intl.NumberFormat(INTL_TAG[locale], {
		style: 'currency',
		currency,
		minimumFractionDigits: minorDigits,
		maximumFractionDigits: minorDigits
	}).format(major);
}

/** Format a plain (non-currency) decimal amount, locale-aware. */
export function formatDecimal(value: number, locale: Locale, fractionDigits = 2): string {
	return new Intl.NumberFormat(INTL_TAG[locale], {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	}).format(value);
}

/** Format a plain integer count, locale-aware (thousands separators etc.),
 * no forced decimals — for entry counts, batch sizes, and the like. */
export function formatCount(value: number, locale: Locale): string {
	return new Intl.NumberFormat(INTL_TAG[locale]).format(value);
}

/**
 * Format an ISO 8601 date/date-time string for display. Throws on an
 * unparseable input — callers pass data that has already round-tripped
 * through the DB/serializer, so a bad ISO string here is a bug worth
 * surfacing, not silently swallowing.
 */
export function formatDate(
	isoDate: string,
	locale: Locale,
	options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`formatDate: not a valid ISO date string: "${isoDate}"`);
	}
	return new Intl.DateTimeFormat(INTL_TAG[locale], options).format(date);
}
