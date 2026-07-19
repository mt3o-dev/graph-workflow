import { describe, expect, it } from 'vitest';
import { contentHash, type ContentHashInput } from './content-hash';
import { normalizeForHash } from '../normalize/description';

const base: ContentHashInput = {
	account: 'PL61 1090 1014 0000 0712 1981 2874',
	bookingDate: '2026-07-19',
	amountMinor: -4599n,
	currency: 'PLN',
	normalizedDescription: normalizeForHash('Grocery Store')
};

describe('contentHash', () => {
	it('is deterministic across repeated calls (same run)', () => {
		expect(contentHash(base)).toBe(contentHash(base));
	});

	it('is deterministic across independently-constructed equal inputs', () => {
		const a = contentHash(base);
		const b = contentHash({ ...base });
		expect(a).toBe(b);
	});

	it('returns a fixed-length lowercase hex string', () => {
		const hash = contentHash(base);
		expect(hash).toMatch(/^[0-9a-f]{16}$/);
	});

	it('is stable for the same logical transaction across whitespace/case/diacritic variants', () => {
		const variantDescriptions = ['Café  Central', 'CAFE CENTRAL', '  cafe   central  '];
		const hashes = variantDescriptions.map((raw) =>
			contentHash({ ...base, normalizedDescription: normalizeForHash(raw) })
		);
		for (const hash of hashes) {
			expect(hash).toBe(hashes[0]);
		}
	});

	it('differs when the account differs', () => {
		expect(contentHash(base)).not.toBe(contentHash({ ...base, account: 'OTHER ACCOUNT' }));
	});

	it('differs when the booking date differs', () => {
		expect(contentHash(base)).not.toBe(contentHash({ ...base, bookingDate: '2026-07-20' }));
	});

	it('differs when the amount differs', () => {
		expect(contentHash(base)).not.toBe(contentHash({ ...base, amountMinor: -4600n }));
	});

	it('differs when the currency differs', () => {
		expect(contentHash(base)).not.toBe(contentHash({ ...base, currency: 'EUR' }));
	});

	it('differs when the normalized description differs', () => {
		expect(contentHash(base)).not.toBe(
			contentHash({ ...base, normalizedDescription: normalizeForHash('Gas Station') })
		);
	});

	it('does not collide across a naive field-concatenation ambiguity', () => {
		// account="AB" + desc="C" vs account="A" + desc="BC" — the U+0001-joined
		// canonical form must not conflate these via naive string concatenation.
		const left = contentHash({ ...base, account: 'AB', normalizedDescription: 'C' });
		const right = contentHash({ ...base, account: 'A', normalizedDescription: 'BC' });
		expect(left).not.toBe(right);
	});
});
