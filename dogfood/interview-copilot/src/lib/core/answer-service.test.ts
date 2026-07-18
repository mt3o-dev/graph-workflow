import { describe, expect, it } from 'vitest';
import type { AnswerPort } from '../ports/answer.port.ts';
import type { RetrievedDoc, Utterance } from '../ports/types.ts';
import { FakeAnswer } from '../../test/fakes/answer.fake.ts';
import { sampleKbDocs } from '../../test/fakes/knowledge-base.fake.ts';
import { AnswerService } from './answer-service.ts';

const question: Utterance = { id: 'u1', text: 'Explain ACID?', startMs: 0, endMs: 1000 };
const docs: RetrievedDoc[] = sampleKbDocs()
	.slice(0, 2)
	.map((doc, i) => ({ doc, score: 1 - i * 0.1 }));

describe('AnswerService', () => {
	it('forwards question, window and docs to the port', async () => {
		const fake = new FakeAnswer();
		const service = new AnswerService(fake);
		const draft = await service.draft(question, [question], docs);
		expect(fake.requests).toHaveLength(1);
		expect(fake.requests[0]!.docs).toEqual(docs);
		expect(draft.text).toContain('Explain ACID?');
	});

	it('clamps source ids to the provided documents', async () => {
		const hallucinating: AnswerPort = {
			draft: async () => ({ text: 'draft', sourceIds: ['th-acid', 'not-a-real-doc'] })
		};
		const service = new AnswerService(hallucinating);
		const draft = await service.draft(question, [question], docs);
		expect(draft.sourceIds).toEqual(['th-acid']);
	});
});
