/**
 * UnpdfTextAdapter — implements PdfTextPort ([dec:4]) using `unpdf` (pinned
 * exact version in package.json), a serverless-friendly wrapper around
 * pdf.js. This is the ONLY file allowed to import a PDF library; every
 * StatementParser consumes the resulting {@link PdfText}, never a PDF byte
 * buffer (see pdf-text.port.ts).
 *
 * Page text is joined with `\f` (form feed) per the port contract ("page
 * breaks as \f, line breaks preserved"). Item coordinates are passed through
 * from unpdf/pdf.js as-is (PDF coordinate space, origin bottom-left); the
 * 1-based page number is stamped on per the port contract since unpdf groups
 * items per-page without it.
 */
import { extractText, extractTextItems, getDocumentProxy } from 'unpdf';
import type { PdfText, PdfTextItem, PdfTextPort } from '../../ports/pdf-text.port.js';

const PAGE_BREAK = '\f';

export class UnpdfTextAdapter implements PdfTextPort {
	async extract(pdf: Uint8Array): Promise<PdfText> {
		const doc = await getDocumentProxy(pdf);

		const [{ totalPages, text: pageTexts }, { items: pageItems }] = await Promise.all([
			extractText(doc, { mergePages: false }),
			extractTextItems(doc)
		]);

		const text = pageTexts.join(PAGE_BREAK);

		const items: PdfTextItem[] = [];
		for (let pageIndex = 0; pageIndex < pageItems.length; pageIndex++) {
			const page = pageIndex + 1;
			for (const item of pageItems[pageIndex]) {
				items.push({ text: item.str, x: item.x, y: item.y, page });
			}
		}

		return { text, items, pageCount: totalPages };
	}
}
