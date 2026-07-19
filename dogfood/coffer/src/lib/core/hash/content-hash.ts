/**
 * Vendored, pure-TS content hash for idempotent import dedup ([dec:5]).
 *
 * `node:crypto` would violate core purity ([dec:2] — boundary-lint forbids any
 * `node:` import under src/lib/core/**). This uses FNV-1a, 64-bit variant,
 * implemented with BigInt — deterministic, dependency-free, and stable across
 * Node versions/platforms (pure integer arithmetic, no locale/timezone
 * involvement). It is a dedup fingerprint, NOT a cryptographic hash — collision
 * resistance requirements here are "don't accidentally dedup two different
 * transactions", not adversarial-proof.
 *
 * Input fields are joined with a control character (U+0001) that will not
 * appear in normal statement text, so field-boundary shifts (e.g. an account
 * name ending in the same characters a description starts with) cannot
 * produce a spurious hash collision via naive concatenation.
 */

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const FIELD_SEPARATOR = '';

export interface ContentHashInput {
	readonly account: string;
	readonly bookingDate: string;
	readonly amountMinor: bigint;
	readonly currency: string;
	/** Must already be the output of normalizeForHash — this function does not normalize. */
	readonly normalizedDescription: string;
}

function fnv1a64(input: string): bigint {
	let hash = FNV_OFFSET_BASIS_64;
	for (let i = 0; i < input.length; i++) {
		hash ^= BigInt(input.charCodeAt(i));
		hash = (hash * FNV_PRIME_64) & MASK_64;
	}
	return hash;
}

/**
 * Stable content hash of (account, bookingDate, amountMinor+currency,
 * normalizedDescription). Returns a lowercase, zero-padded 16-hex-digit
 * string (64 bits).
 */
export function contentHash(input: ContentHashInput): string {
	const canonical = [
		input.account,
		input.bookingDate,
		input.amountMinor.toString(),
		input.currency,
		input.normalizedDescription
	].join(FIELD_SEPARATOR);
	return fnv1a64(canonical).toString(16).padStart(16, '0');
}
