/**
 * Locale detection/persistence helpers. Pure functions (no `node:*`, no
 * SvelteKit `Cookies` type) so they're usable from both the P5
 * locale-negotiation `handle` (server) and, later, client code — and so
 * they stay trivially unit-testable without a request/response fixture.
 *
 * Precedence: `coffer_locale` cookie (explicit user choice) > configured
 * `locale.default` ([ConfigPort] `locale.default`, [dec:11]) > `'en'` as an
 * absolute last resort if config itself is unavailable.
 */
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from './t.js';

/** Name of the cookie that persists an explicit locale choice. */
export const LOCALE_COOKIE_NAME = 'coffer_locale';

/** One year, in seconds — the cookie `Max-Age` a caller should set when
 * persisting an explicit locale choice. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export { SUPPORTED_LOCALES, isSupportedLocale };
export type { Locale };

/**
 * Resolve the effective locale for a request: an explicit, supported cookie
 * value wins; otherwise fall back to the configured default; otherwise
 * `'en'`. Never throws — an unsupported/garbled cookie value is treated as
 * absent rather than an error, so a stale or hand-edited cookie can't lock a
 * visitor out of the app.
 */
export function resolveLocale(cookieValue: string | undefined | null, configDefault: string | undefined): Locale {
	if (isSupportedLocale(cookieValue)) {
		return cookieValue;
	}
	if (isSupportedLocale(configDefault)) {
		return configDefault;
	}
	return 'en';
}
