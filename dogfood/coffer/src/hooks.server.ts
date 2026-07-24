/**
 * Server hooks ([node:d8caed23]). `sequence()`-composed so the (still
 * pending, P2/P4) locale-negotiation handle has a clean slot ahead of auth —
 * left as an explicit passthrough below.
 */
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { createAuthHandle } from '$lib/server/auth/handle.js';
import { sessionSecret } from '$lib/server/auth/runtime.js';

/**
 * Locale-negotiation composition point (P2/P4 owns the real implementation —
 * reading `coffer_locale` / `Accept-Language` and stamping `event.locals`).
 * Passthrough for now so `sequence()` ordering is already correct.
 */
const localeHandle: Handle = async ({ event, resolve }) => resolve(event);

const authHandle = createAuthHandle({ sessionSecret });

export const handle = sequence(localeHandle, authHandle);
