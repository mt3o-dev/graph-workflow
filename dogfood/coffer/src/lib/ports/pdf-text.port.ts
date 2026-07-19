/**
 * A positioned text run extracted from a PDF page — the minimum a tabular
 * parser needs to reconstruct columns without a PDF library of its own.
 */
export interface PdfTextItem {
	readonly text: string;
	/** X position in PDF user-space units (left origin). */
	readonly x: number;
	/** Y position in PDF user-space units (baseline; page-top varies by producer). */
	readonly y: number;
	/** 1-based page number. */
	readonly page: number;
}

/** Extracted text of a whole document: page-ordered plain text plus items. */
export interface PdfText {
	/** Concatenated plain text, page breaks as \f, line breaks preserved. */
	readonly text: string;
	/** Positioned runs, in reading order per page. Empty if the producer only
	 * yields flat text. */
	readonly items: PdfTextItem[];
	readonly pageCount: number;
}

/**
 * Extracts a text layer from a PDF byte payload (dec:4). This is the ONLY seam
 * that touches a PDF library (unpdf); parsers consume {@link PdfText}, never a
 * PDF buffer, which is what keeps the fragile bank-specific parsing testable on
 * committed fixture text and free of the PDF binary in unit tests.
 *
 * Image-only (no text layer) PDFs are out of scope in v1 (OCR — PRD accepted
 * gap): an implementation may return empty text for such a document.
 */
export interface PdfTextPort {
	extract(pdf: Uint8Array): Promise<PdfText>;
}
