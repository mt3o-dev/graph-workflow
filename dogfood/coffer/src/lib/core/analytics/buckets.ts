/**
 * Pure day/week/month bucketing over ISO date strings (coffer-analytics
 * slice 3, P1). Timezone-free: dates are parsed by splitting the
 * "YYYY-MM-DD" string into integer y/m/d components and all arithmetic runs
 * through `Date.UTC` + `getUTC*` accessors — NEVER `new Date(localString)`
 * or a local `get*` accessor, which would drift with the host's timezone.
 *
 * Pure TS only — no `node:` imports, no runtime libraries (boundary-lint).
 */
import type { Granularity } from './model.js';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse the "YYYY-MM-DD" prefix of an ISO date/datetime string into a UTC-midnight epoch-ms timestamp. */
export function parseIsoDateUtc(isoDate: string): number {
	const match = ISO_DATE_RE.exec(isoDate);
	if (!match) {
		throw new Error(`parseIsoDateUtc: not an ISO date string: ${isoDate}`);
	}
	const [, y, m, d] = match;
	return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Render a UTC-midnight epoch-ms timestamp back to "YYYY-MM-DD". */
export function formatIsoDateUtc(epochMs: number): string {
	const date = new Date(epochMs);
	const y = date.getUTCFullYear().toString().padStart(4, '0');
	const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
	const d = date.getUTCDate().toString().padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** The bucket START, as "YYYY-MM-DD", for `isoDate` at the given `granularity`. */
export function bucketOf(isoDate: string, granularity: Granularity): string {
	const epochMs = parseIsoDateUtc(isoDate);
	switch (granularity) {
		case 'day':
			return formatIsoDateUtc(epochMs);
		case 'week':
			return formatIsoDateUtc(startOfIsoWeekUtc(epochMs));
		case 'month':
			return formatIsoDateUtc(startOfMonthUtc(epochMs));
	}
}

/**
 * The UTC-midnight epoch-ms of the Monday starting the ISO week containing
 * `epochMs`. ISO weeks start Monday (`getUTCDay()`: 0=Sun..6=Sat, so Monday
 * offset is `(day + 6) % 7`).
 */
function startOfIsoWeekUtc(epochMs: number): number {
	const date = new Date(epochMs);
	const day = date.getUTCDay();
	const mondayOffsetDays = (day + 6) % 7;
	return epochMs - mondayOffsetDays * 24 * 60 * 60 * 1000;
}

/** The UTC-midnight epoch-ms of the first day of the month containing `epochMs`. */
function startOfMonthUtc(epochMs: number): number {
	const date = new Date(epochMs);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}
