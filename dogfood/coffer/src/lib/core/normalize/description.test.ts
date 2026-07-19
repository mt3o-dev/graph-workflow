import { describe, expect, it } from 'vitest';
import { normalizeForHash } from './description';

describe('normalizeForHash', () => {
	it('collapses internal whitespace runs to a single space', () => {
		expect(normalizeForHash('GROCERY   STORE\tPURCHASE')).toBe('GROCERY STORE PURCHASE');
	});

	it('trims leading and trailing whitespace', () => {
		expect(normalizeForHash('   spaced out   ')).toBe('SPACED OUT');
	});

	it('upper-case folds', () => {
		expect(normalizeForHash('Grocery Store')).toBe('GROCERY STORE');
	});

	it('strips diacritics carried as combining marks after NFKD decomposition', () => {
		// "café" (é = e + combining acute after NFKD) hashes the same as "cafe".
		expect(normalizeForHash('café')).toBe(normalizeForHash('cafe'));
	});

	it('same logical description with different spacing/case/diacritics normalizes identically', () => {
		const variants = ['Café  Central', 'CAFE CENTRAL', '  cafe   central  ', 'Café\tCentral'];
		const normalized = variants.map(normalizeForHash);
		for (const value of normalized) {
			expect(value).toBe(normalized[0]);
		}
	});

	it('genuinely different descriptions normalize differently', () => {
		expect(normalizeForHash('Grocery Store')).not.toBe(normalizeForHash('Gas Station'));
	});

	it('is idempotent (normalizing twice equals normalizing once)', () => {
		const once = normalizeForHash('  Café   Central  ');
		expect(normalizeForHash(once)).toBe(once);
	});
});
