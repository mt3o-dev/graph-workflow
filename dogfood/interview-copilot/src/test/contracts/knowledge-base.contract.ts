import { describe, expect, it } from 'vitest';
import type { KnowledgeBasePort } from '../../lib/ports/knowledge-base.port.ts';
import { KB_CATEGORIES, KB_DIFFICULTIES, KB_EXPERTISE } from '../../lib/ports/types.ts';

/** Shared KnowledgeBasePort contract. */
export function describeKnowledgeBaseContract(
	name: string,
	factory: () => Promise<KnowledgeBasePort> | KnowledgeBasePort
) {
	describe(`KnowledgeBasePort contract: ${name}`, () => {
		it('lists at least one schema-valid doc', async () => {
			const kb = await factory();
			const docs = await kb.listDocs();
			expect(docs.length).toBeGreaterThan(0);
			for (const doc of docs) {
				expect(doc.id.length).toBeGreaterThan(0);
				expect(doc.question.length).toBeGreaterThan(0);
				expect(doc.answer.length).toBeGreaterThan(0);
				expect(KB_CATEGORIES).toContain(doc.category);
				expect(KB_DIFFICULTIES).toContain(doc.difficulty);
				expect(KB_EXPERTISE).toContain(doc.expertise);
				expect(doc.tags.length).toBeGreaterThanOrEqual(2);
			}
		});

		it('has unique ids and getDoc roundtrips every listed doc', async () => {
			const kb = await factory();
			const docs = await kb.listDocs();
			expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
			for (const doc of docs) {
				expect(await kb.getDoc(doc.id)).toEqual(doc);
			}
		});

		it('returns null for an unknown id', async () => {
			const kb = await factory();
			expect(await kb.getDoc('definitely-not-a-doc-id')).toBeNull();
		});
	});
}
