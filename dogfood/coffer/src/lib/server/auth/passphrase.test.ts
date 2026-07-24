import { describe, expect, it } from 'vitest';
import { verifyPassphrase } from './passphrase.js';

describe('verifyPassphrase', () => {
	it('accepts the exact configured passphrase', () => {
		expect(verifyPassphrase('open-sesame', 'open-sesame')).toBe(true);
	});

	it('rejects a wrong passphrase', () => {
		expect(verifyPassphrase('wrong', 'open-sesame')).toBe(false);
	});

	it('rejects passphrases of a different length than the configured one (constant-time path, no length shortcut)', () => {
		expect(verifyPassphrase('x', 'a-much-longer-configured-passphrase')).toBe(false);
	});

	it('is fail-closed: rejects every attempt when no passphrase is configured', () => {
		expect(verifyPassphrase('anything', undefined)).toBe(false);
		expect(verifyPassphrase('', undefined)).toBe(false);
	});
});
