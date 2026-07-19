/**
 * UnpdfTextAdapter tests. Per plan.md Phase 5: the real-binary extract path
 * must never be required for the slice's green — it's skip-guarded on a
 * fixture `.pdf` file being present (none is committed; no real bank PDFs in
 * this slice) AND on `unpdf` being importable at all on this machine.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UnpdfTextAdapter } from './unpdf-text.adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = join(__dirname, '../../../test/fixtures/statements/sample.pdf');

async function isUnpdfAvailable(): Promise<boolean> {
	try {
		await import('unpdf');
		return true;
	} catch {
		return false;
	}
}

describe('UnpdfTextAdapter: wiring (no PDF binary required)', () => {
	it('implements the PdfTextPort shape (extract method)', () => {
		const adapter = new UnpdfTextAdapter();
		expect(typeof adapter.extract).toBe('function');
	});
});

describe.skipIf(!existsSync(FIXTURE_PDF))(
	'UnpdfTextAdapter: real-binary extract (skipped — no fixture PDF committed in this slice)',
	() => {
		it('extracts text, items, and pageCount from a real PDF fixture', async () => {
			if (!(await isUnpdfAvailable())) {
				return;
			}
			const adapter = new UnpdfTextAdapter();
			const bytes = new Uint8Array(readFileSync(FIXTURE_PDF));
			const result = await adapter.extract(bytes);
			expect(result.pageCount).toBeGreaterThan(0);
			expect(typeof result.text).toBe('string');
			expect(Array.isArray(result.items)).toBe(true);
		});
	}
);
