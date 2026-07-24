import { describe, expect, it, vi } from 'vitest';
import { attemptLogin, clearSession } from './login.js';
import { SESSION_COOKIE_NAME } from './constants.js';
import { verifySession } from './session.js';

function fakeCookies() {
	return { set: vi.fn(), delete: vi.fn() };
}

describe('attemptLogin', () => {
	it('happy path: correct passphrase sets a valid, HttpOnly+Secure+SameSite=Lax session cookie and returns true', () => {
		const cookies = fakeCookies();
		const now = Date.now();

		const ok = attemptLogin({
			passphrase: 'correct-horse-battery-staple',
			configuredPassword: 'correct-horse-battery-staple',
			sessionSecret: 'secret',
			cookies,
			now
		});

		expect(ok).toBe(true);
		expect(cookies.set).toHaveBeenCalledTimes(1);
		const [name, value, opts] = cookies.set.mock.calls[0];
		expect(name).toBe(SESSION_COOKIE_NAME);
		expect(opts).toMatchObject({ path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
		expect(verifySession('secret', value, now)).toBe(true);
	});

	it('wrong passphrase (constant-time compare exercised): rejects and never sets a cookie', () => {
		const cookies = fakeCookies();

		const ok = attemptLogin({
			passphrase: 'guess',
			configuredPassword: 'correct-horse-battery-staple',
			sessionSecret: 'secret',
			cookies
		});

		expect(ok).toBe(false);
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('fail-closed: rejects every attempt when no passphrase is configured, even the empty string', () => {
		const cookies = fakeCookies();

		const ok = attemptLogin({
			passphrase: '',
			configuredPassword: undefined,
			sessionSecret: 'secret',
			cookies
		});

		expect(ok).toBe(false);
		expect(cookies.set).not.toHaveBeenCalled();
	});
});

describe('clearSession', () => {
	it('deletes the session cookie at the root path', () => {
		const cookies = fakeCookies();
		clearSession(cookies);
		expect(cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: '/' });
	});
});
