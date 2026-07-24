import { describe, expect, it } from 'vitest';
import { bucketOf, formatIsoDateUtc, parseIsoDateUtc } from './buckets.js';

describe('parseIsoDateUtc / formatIsoDateUtc', () => {
	it('round-trips a plain date', () => {
		expect(formatIsoDateUtc(parseIsoDateUtc('2026-07-19'))).toBe('2026-07-19');
	});

	it('parses only the date prefix of a full ISO datetime', () => {
		expect(formatIsoDateUtc(parseIsoDateUtc('2026-07-19T23:59:59Z'))).toBe('2026-07-19');
	});

	it('throws on a non-ISO string', () => {
		expect(() => parseIsoDateUtc('19/07/2026')).toThrow();
	});
});

describe('bucketOf: day', () => {
	it('is the date itself', () => {
		expect(bucketOf('2026-07-19', 'day')).toBe('2026-07-19');
	});
});

describe('bucketOf: week (ISO, Monday start)', () => {
	it('buckets a Wednesday to the preceding Monday', () => {
		// 2026-07-22 is a Wednesday.
		expect(bucketOf('2026-07-22', 'week')).toBe('2026-07-20');
	});

	it('a Monday buckets to itself', () => {
		expect(bucketOf('2026-07-20', 'week')).toBe('2026-07-20');
	});

	it('a Sunday buckets to the Monday that started its week (not the next Monday)', () => {
		// 2026-07-26 is a Sunday, week started 2026-07-20.
		expect(bucketOf('2026-07-26', 'week')).toBe('2026-07-20');
	});

	it('handles a week spanning a month boundary', () => {
		// 2026-08-01 is a Saturday; ISO week starts Monday 2026-07-27.
		expect(bucketOf('2026-08-01', 'week')).toBe('2026-07-27');
	});

	it('handles a week spanning a year boundary', () => {
		// 2027-01-01 is a Friday; ISO week starts Monday 2026-12-28.
		expect(bucketOf('2027-01-01', 'week')).toBe('2026-12-28');
	});
});

describe('bucketOf: month', () => {
	it('buckets to the first of the month', () => {
		expect(bucketOf('2026-07-19', 'month')).toBe('2026-07-01');
	});

	it('handles 31-day months', () => {
		expect(bucketOf('2026-07-31', 'month')).toBe('2026-07-01');
	});

	it('handles 30-day months', () => {
		expect(bucketOf('2026-04-30', 'month')).toBe('2026-04-01');
	});

	it('handles February in a leap year (2028, 29 days)', () => {
		expect(bucketOf('2028-02-29', 'month')).toBe('2028-02-01');
	});

	it('handles February in a non-leap year (2026, 28 days)', () => {
		expect(bucketOf('2026-02-28', 'month')).toBe('2026-02-01');
	});

	it('handles a year rollover (December -> January)', () => {
		expect(bucketOf('2026-12-31', 'month')).toBe('2026-12-01');
		expect(bucketOf('2027-01-01', 'month')).toBe('2027-01-01');
	});
});

describe('no local-timezone drift', () => {
	it('midnight-boundary dates bucket consistently regardless of host TZ (UTC arithmetic only)', () => {
		// If this ever used `new Date(str)`/local getters, a host running e.g.
		// TZ=Pacific/Kiritimati (UTC+14) or TZ=Etc/GMT+12 could shift the day.
		expect(bucketOf('2026-01-01', 'day')).toBe('2026-01-01');
		expect(bucketOf('2026-01-01', 'month')).toBe('2026-01-01');
	});
});
