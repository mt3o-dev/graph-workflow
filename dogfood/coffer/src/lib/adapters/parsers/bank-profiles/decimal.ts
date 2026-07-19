/**
 * Shared decimal-string -> integer-minor-units conversion for bank profiles.
 * Never uses floats (Money.minor is a bigint end to end — plan.md Phase 2
 * risk note "amount float drift").
 */

/** Matches an optionally-signed decimal amount, e.g. "-54.32", "3500.00". */
export const DECIMAL_AMOUNT_RE = /^-?\d+\.\d{1,2}$/;

/**
 * Convert a plain decimal-string amount (e.g. "54.32", "-120") to integer
 * minor units (e.g. 5432n, -12000n). Assumes 2 minor digits (cents-like);
 * pads a missing or single fractional digit.
 */
export function decimalToMinor(raw: string): bigint {
	const trimmed = raw.trim();
	const negative = trimmed.startsWith('-');
	const unsigned = negative ? trimmed.slice(1) : trimmed;
	const [wholePart, fractionPart = ''] = unsigned.split('.');
	const fraction = fractionPart.padEnd(2, '0').slice(0, 2);
	const minor = BigInt(wholePart || '0') * 100n + BigInt(fraction || '0');
	return negative ? -minor : minor;
}
