/**
 * Auth constants ([node:d8caed23]). Server-only.
 */

/** Name of the signed session cookie. */
export const SESSION_COOKIE_NAME = 'coffer_session';

/** Session lifetime — 7 days. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Small clock-skew tolerance applied when checking an incoming session's
 * expiry, so a request that lands a few seconds late (server clock drift,
 * queueing) isn't spuriously rejected right at the boundary.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 2000;
