/**
 * Passphrase verification ([node:d8caed23]). Server-only — `node:crypto`
 * lives here, never in core ([dec:2]).
 *
 * Hashes both sides to fixed-length SHA-256 digests before comparing with
 * `timingSafeEqual`, so the comparison is constant-time AND never leaks the
 * configured passphrase's length via early-exit string comparison (both
 * digests are always 32 bytes, regardless of the raw passphrase length).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
	return createHash('sha256').update(value, 'utf-8').digest();
}

/**
 * Constant-time passphrase check. Fail-closed: if `configured` is missing
 * (no `auth.password` set), every attempt is rejected — there is no
 * "no password required" mode.
 */
export function verifyPassphrase(candidate: string, configured: string | undefined): boolean {
	if (!configured) {
		return false;
	}
	return timingSafeEqual(digest(candidate), digest(configured));
}
