import { describe, expect, it } from 'vitest';
import type { AnswerPort } from '../../lib/ports/answer.port.ts';
import type { RetrievedDoc, Utterance } from '../../lib/ports/types.ts';
import { sampleKbDocs } from '../fakes/knowledge-base.fake.ts';

const question: Utterance = {
	id: 'u9',
	text: 'Can you explain the ACID properties of a database transaction?',
	startMs: 0,
	endMs: 2000
};

const docs: RetrievedDoc[] = sampleKbDocs()
	.slice(0, 3)
	.map((doc, i) => ({ doc, score: 0.9 - i * 0.1 }));

/**
 * Shared AnswerPort contract. Network adapters run it against a mocked
 * transport that returns a draft citing at least one provided doc id.
 */
export function describeAnswerContract(
	name: string,
	factory: () => Promise<AnswerPort> | AnswerPort
) {
	describe(`AnswerPort contract: ${name}`, () => {
		it('returns a non-empty draft for a grounded question', async () => {
			const port = await factory();
			const draft = await port.draft({ question, window: [question], docs });
			expect(draft.text.trim().length).toBeGreaterThan(0);
		});

		it('cites only ids from the provided documents', async () => {
			const port = await factory();
			const draft = await port.draft({ question, window: [question], docs });
			const known = new Set(docs.map((d) => d.doc.id));
			expect(draft.sourceIds.length).toBeGreaterThan(0);
			for (const id of draft.sourceIds) expect(known.has(id)).toBe(true);
		});

		it('handles an empty retrieval set without throwing', async () => {
			const port = await factory();
			const draft = await port.draft({ question, window: [question], docs: [] });
			expect(draft.sourceIds).toEqual([]);
		});
	});
}
