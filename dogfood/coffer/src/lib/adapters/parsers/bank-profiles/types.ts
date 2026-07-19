/**
 * BankProfile — the extension seam for `generic-tabular-pdf` (dec:4, plan
 * Phase 5). Each profile recognizes ONE header-column layout (a "bank
 * statement dialect") in already-extracted PDF text and knows how to turn a
 * data row line into a candidate for `ParsedRow`.
 *
 * Adding support for a new real-world bank layout means adding a new
 * `BankProfile` here, NOT touching the generic parser itself.
 */

/** A row a profile has parsed, before Money construction (amount is in
 *  decimal-string minor-unit form; the parser applies `money()`). */
export interface ParsedRowCandidate {
	/** ISO 8601 date, e.g. "2026-06-02". */
	readonly bookingDate: string;
	readonly valueDate: string;
	readonly description: string;
	readonly counterparty: string;
	/** Signed integer minor units (e.g. cents), already sign-adjusted for
	 *  direction (negative = money out, positive = money in). */
	readonly amountMinor: bigint;
}

export interface BankProfile {
	/** Stable identifier for diagnostics; not part of the parser contract. */
	readonly id: string;

	/** True if `line` is this profile's header row (column-name signature). */
	matchesHeader(line: string): boolean;

	/**
	 * Parse one line as a data row under this profile. Returns `null` for
	 * anything that isn't a data row (blank lines, footers, page furniture) —
	 * the generic parser treats `null` as "skip, not an error".
	 */
	parseRow(line: string): ParsedRowCandidate | null;
}
