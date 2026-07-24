/**
 * Root layout load: resolves the effective locale for the request so every
 * `+page.svelte` down the tree gets `data.locale` for free (SvelteKit merges
 * ancestor layout `load()` returns into each page's `data`).
 *
 * Uses P2's `resolveLocale` precedence directly (cookie > configured default
 * > 'en') — the configured-default leg is left as `undefined` here since
 * wiring `locals`/`ConfigPort` through `hooks.server.ts`'s locale-negotiation
 * handle is explicitly P6's integration job (plan.md P6), not P4's; the
 * cookie leg (an explicit user choice, [node:aeb2d1f6]-adjacent) already
 * covers the locale switcher this phase ships.
 */
import type { LayoutServerLoad } from './$types.js';
import { LOCALE_COOKIE_NAME, resolveLocale } from '$lib/i18n/locale.js';

export const load: LayoutServerLoad = ({ cookies }) => {
	const locale = resolveLocale(cookies.get(LOCALE_COOKIE_NAME), undefined);
	return { locale };
};
