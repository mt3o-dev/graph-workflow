import { describe, expect, it } from 'vitest';
import { issueSession, verifySession } from './session.js';

const SECRET = 'test-session-secret';
const TTL_MS = 1000 * 60 * 60;

describe('issueSession / verifySession', () => {
	it('round-trips: a freshly issued session verifies as valid', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		expect(verifySession(SECRET, cookie, now)).toBe(true);
	});

	it('rejects a tampered payload', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		const [payload, signature] = cookie.split('.');
		const tamperedPayload = payload.slice(0, -1) + (payload.at(-1) === 'A' ? 'B' : 'A');
		expect(verifySession(SECRET, `${tamperedPayload}.${signature}`, now)).toBe(false);
	});

	it('rejects a tampered signature', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		const [payload, signature] = cookie.split('.');
		const tamperedSignature = signature.slice(0, -1) + (signature.at(-1) === 'a' ? 'b' : 'a');
		expect(verifySession(SECRET, `${payload}.${tamperedSignature}`, now)).toBe(false);
	});

	it('rejects garbage appended to an otherwise-valid signature (not silently truncated by hex decoding)', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		expect(verifySession(SECRET, `${cookie}tampered`, now)).toBe(false);
	});

	it('rejects a session signed with a different secret', () => {
		const now = Date.now();
		const cookie = issueSession('other-secret', TTL_MS, now);
		expect(verifySession(SECRET, cookie, now)).toBe(false);
	});

	it('rejects an expired session', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		const wayAfterExpiry = now + TTL_MS + 60_000;
		expect(verifySession(SECRET, cookie, wayAfterExpiry)).toBe(false);
	});

	it('is skew-tolerant: a session checked a couple seconds past its exact expiry still verifies', () => {
		const now = Date.now();
		const cookie = issueSession(SECRET, TTL_MS, now);
		const justAfterExpiry = now + TTL_MS + 1000; // within CLOCK_SKEW_TOLERANCE_MS
		expect(verifySession(SECRET, cookie, justAfterExpiry)).toBe(true);
	});

	it('rejects malformed cookie values', () => {
		const now = Date.now();
		expect(verifySession(SECRET, undefined, now)).toBe(false);
		expect(verifySession(SECRET, null, now)).toBe(false);
		expect(verifySession(SECRET, '', now)).toBe(false);
		expect(verifySession(SECRET, 'no-dot-separator', now)).toBe(false);
		expect(verifySession(SECRET, '..', now)).toBe(false);
	});
});
