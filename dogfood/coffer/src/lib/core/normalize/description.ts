/**
 * Shared description normalization for HASHING ONLY ([dec:5]).
 *
 * Defined exactly once, here, in core — every StatementParserPort adapter
 * (PDF/CSV/OFX, all in later phases) must funnel its description through
 * `normalizeForHash` before hashing, not roll its own. The raw/display
 * description (`Transaction.description`, `ParsedRow.description`) is NEVER
 * passed through this function — it stays untouched for display.
 *
 * Steps (in order), all locale/whitespace-stable:
 * 1. Unicode-normalize to NFKD (decomposes accented chars into base + combining marks).
 * 2. Strip combining diacritical marks (U+0300-U+036F) so e.g. "Zazolc" and
 *    the diacritic-bearing original hash identically.
 * 3. Collapse all internal whitespace runs to a single space; trim ends.
 * 4. Upper-case fold (locale-independent enough for this use: hash stability,
 *    not display).
 */
const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;
const WHITESPACE_RUN = /\s+/g;

export function normalizeForHash(raw: string): string {
	return raw
		.normalize('NFKD')
		.replace(COMBINING_DIACRITICAL_MARKS, '')
		.replace(WHITESPACE_RUN, ' ')
		.trim()
		.toUpperCase();
}
