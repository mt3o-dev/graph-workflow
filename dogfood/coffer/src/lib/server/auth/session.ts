/**
 * Session issuance/verification ([node:d8caed23]): the `coffer_session`
 * cookie value is `<base64url payload>.<hex HMAC-SHA256 signature>`, where
 * the payload carries only an expiry timestamp. Tamper (payload OR
 * signature mutated) fails verification; expiry is checked with a small
 * clock-skew tolerance ([`CLOCK_SKEW_TOLERANCE_MS`]).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CLOCK_SKEW_TOLERANCE_MS } from './constants.js';

interface SessionPayload {
	/** Epoch-ms expiry. */
	exp: number;
}

function encodePayload(payload: SessionPayload): string {
	return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodePayload(encoded: string): SessionPayload | undefined {
	try {
		const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'exp' in parsed &&
			typeof (parsed as { exp: unknown }).exp === 'number'
		) {
			return parsed as SessionPayload;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function sign(secret: string, payloadB64: string): string {
	return createHmac('sha256', secret).update(payloadB64).digest('hex');
}

/** Mint a signed session cookie value, valid for `ttlMs` from `now`. */
export function issueSession(secret: string, ttlMs: number, now: number = Date.now()): string {
	const payloadB64 = encodePayload({ exp: now + ttlMs });
	return `${payloadB64}.${sign(secret, payloadB64)}`;
}

/**
 * Verify a session cookie value: checks the HMAC signature (constant-time)
 * and the expiry (with clock-skew tolerance). Returns `false` for any
 * malformed, tampered, or expired value — never throws.
 */
export function verifySession(secret: string, cookieValue: string | undefined | null, now: number = Date.now()): boolean {
	if (!cookieValue) {
		return false;
	}
	const separatorIndex = cookieValue.indexOf('.');
	if (separatorIndex === -1) {
		return false;
	}
	const payloadB64 = cookieValue.slice(0, separatorIndex);
	const signature = cookieValue.slice(separatorIndex + 1);

	const expectedSignature = sign(secret, payloadB64);
	// `Buffer.from(str, 'hex')` silently stops at the first invalid hex pair
	// rather than throwing, so trailing garbage appended to an otherwise
	// valid signature would decode to the SAME bytes as the untampered one —
	// a strict string-length check (before decoding) closes that gap.
	if (signature.length !== expectedSignature.length) {
		return false;
	}
	const signatureBuf = Buffer.from(signature, 'hex');
	const expectedBuf = Buffer.from(expectedSignature, 'hex');
	if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
		return false;
	}

	const payload = decodePayload(payloadB64);
	if (!payload) {
		return false;
	}
	return now <= payload.exp + CLOCK_SKEW_TOLERANCE_MS;
}
