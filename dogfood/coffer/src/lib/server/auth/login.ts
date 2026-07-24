/**
 * Login/logout side effects ([node:d8caed23]) — kept decoupled from the
 * SvelteKit action wiring so they're testable against fake cookies without a
 * real `RequestEvent`.
 */
import { CLOCK_SKEW_TOLERANCE_MS, SESSION_COOKIE_NAME, SESSION_TTL_MS } from './constants.js';
import { verifyPassphrase } from './passphrase.js';
import { issueSession } from './session.js';

/** The minimal cookie-jar surface the auth module depends on (matches SvelteKit's `Cookies`). */
export interface CookieSetter {
	set(
		name: string,
		value: string,
		opts: {
			path: string;
			httpOnly: boolean;
			secure: boolean;
			sameSite: 'lax' | 'strict' | 'none';
			maxAge: number;
		}
	): void;
}

export interface CookieClearer {
	delete(name: string, opts: { path: string }): void;
}

export interface LoginAttemptOptions {
	passphrase: string;
	configuredPassword: string | undefined;
	sessionSecret: string;
	cookies: CookieSetter;
	now?: number;
}

/**
 * Verify `passphrase` against the configured password; on success, sets the
 * signed session cookie and returns `true`. Fail-closed: a missing
 * `configuredPassword` always rejects (delegated to `verifyPassphrase`).
 */
export function attemptLogin(opts: LoginAttemptOptions): boolean {
	const ok = verifyPassphrase(opts.passphrase, opts.configuredPassword);
	if (!ok) {
		return false;
	}
	const value = issueSession(opts.sessionSecret, SESSION_TTL_MS, opts.now);
	opts.cookies.set(SESSION_COOKIE_NAME, value, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: Math.floor((SESSION_TTL_MS + CLOCK_SKEW_TOLERANCE_MS) / 1000)
	});
	return true;
}

/** Clear the session cookie (logout). */
export function clearSession(cookies: CookieClearer): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
