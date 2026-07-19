import type { ParsedRow } from '../core/model/transaction';

/**
 * Identifier for a statement-parser implementation, matched to config's
 * `import.enabledParsers` (dec:11) and used to route a source to its parser.
 */
export type ParserId = 'generic-tabular-pdf' | 'csv' | 'ofx';

/**
 * Context a parser needs that is not carried in the raw payload itself —
 * e.g. which account these rows belong to, and a currency fallback for
 * formats that omit it. Supplied by the import pipeline / caller.
 */
export interface ParseContext {
	/** Account these rows belong to (statements rarely name it inline). */
	readonly sourceAccount: string;
	/** ISO 4217 currency to assume when the format carries none. */
	readonly defaultCurrency: string;
}

/**
 * A single statement parser. Given an already-decoded payload (text for the
 * tabular-PDF parser, file contents for CSV/OFX) it yields normalized
 * {@link ParsedRow}s. Parsers are PURE with respect to storage and PDF binary
 * handling: they never touch the DB or a PDF library — text extraction is the
 * PdfTextPort's job (dec:4), persistence is the StorePort's (dec:3).
 */
export interface StatementParser {
	readonly id: ParserId;

	/**
	 * True if this parser recognizes the payload (header signature, format
	 * markers). Lets the pipeline auto-select without the caller knowing the
	 * bank/format. Cheap; must not throw on unrecognized input — return false.
	 */
	canParse(payload: string, ctx: ParseContext): boolean;

	/**
	 * Parse the payload into rows. Throws only on a payload this parser claimed
	 * (`canParse` true) but cannot read — a genuine data error worth surfacing.
	 */
	parse(payload: string, ctx: ParseContext): ParsedRow[];
}
