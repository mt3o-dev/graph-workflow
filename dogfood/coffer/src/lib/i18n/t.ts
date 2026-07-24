/**
 * `t(locale, key, params?)` — the single reader for the typed catalog
 * ([node:a0330a47]). Params are typed per-key: if `en`'s entry for `key` is
 * a function `(p: X) => string`, `t` requires a matching `X` argument; if
 * it's a plain string, `t` takes no third argument at all (a param object
 * for a non-interpolated key is a typecheck error, not a silently-ignored
 * runtime no-op).
 */
import { en } from './messages/en.js';
import { pl } from './messages/pl.js';
import type { MessageKey } from './keys.js';

export const SUPPORTED_LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const catalogs = { en, pl } satisfies Record<Locale, unknown>;

export function isSupportedLocale(value: string | undefined | null): value is Locale {
	return value != null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Extracts the param type for a key from `en`'s function signature, or
 * `undefined` for a plain-string key (no params accepted). */
type ParamsOf<K extends MessageKey> = (typeof en)[K] extends (params: infer P) => string ? P : undefined;

/** Overload: plain-string keys take no third argument. */
export function t<K extends MessageKey>(
	locale: Locale,
	key: ParamsOf<K> extends undefined ? K : never
): string;
/** Overload: interpolated keys require their typed param object. */
export function t<K extends MessageKey>(
	locale: Locale,
	key: ParamsOf<K> extends undefined ? never : K,
	params: ParamsOf<K>
): string;
export function t<K extends MessageKey>(locale: Locale, key: K, params?: ParamsOf<K>): string {
	const catalog = catalogs[locale] ?? catalogs.en;
	const value = catalog[key];
	if (typeof value === 'function') {
		return (value as (p: ParamsOf<K>) => string)(params as ParamsOf<K>);
	}
	return value as string;
}
