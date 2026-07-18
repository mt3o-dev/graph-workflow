import { describe, expect, it } from 'vitest';
import type { TranscriptSegment } from '../ports/types.ts';
import { FakeAnswer } from '../../test/fakes/answer.fake.ts';
import { FakeEmbeddings } from '../../test/fakes/embeddings.fake.ts';
import { FakeKnowledgeBase, sampleKbDocs } from '../../test/fakes/knowledge-base.fake.ts';
import { FakeSessionLog } from '../../test/fakes/session-log.fake.ts';
import { FakeTranscription } from '../../test/fakes/transcription.fake.ts';
import { FakeVectorIndex } from '../../test/fakes/vector-index.fake.ts';
import questionFixture from '../../test/fixtures/transcripts/question-session.json';
import statementFixture from '../../test/fixtures/transcripts/statement-session.json';
import { AnswerService } from './answer-service.ts';
import { HeuristicQuestionClassifier } from './question-classifier.ts';
import { Retriever } from './retriever.ts';
import { SessionOrchestrator, type SessionEvent } from './session-orchestrator.ts';

async function makeOrchestrator() {
	const transcription = new FakeTranscription();
	const sessionLog = new FakeSessionLog();
	const answerPort = new FakeAnswer();
	const retriever = new Retriever(
		{
			embeddings: new FakeEmbeddings(),
			index: new FakeVectorIndex(),
			kb: new FakeKnowledgeBase(sampleKbDocs())
		},
		{ topK: 4 }
	);
	await retriever.indexKnowledgeBase();
	const orchestrator = new SessionOrchestrator(
		{
			transcription,
			classifier: new HeuristicQuestionClassifier(),
			retriever,
			answers: new AnswerService(answerPort),
			sessionLog
		},
		{ silenceMs: 700, maxSeconds: 30, maxUtterances: 6 }
	);
	const events: SessionEvent[] = [];
	orchestrator.onEvent((e) => events.push(e));
	return { orchestrator, transcription, sessionLog, events };
}

async function runFixture(segments: TranscriptSegment[]) {
	const harness = await makeOrchestrator();
	await harness.orchestrator.start();
	for (const segment of segments) harness.transcription.emit(segment);
	await harness.orchestrator.stop();
	return harness;
}

describe('SessionOrchestrator (recorded-transcript fixtures, end-to-end on fakes)', () => {
	it('a fixture with one question triggers exactly one retrieval and one answer', async () => {
		const { events, sessionLog, orchestrator } = await runFixture(
			questionFixture.segments as TranscriptSegment[]
		);
		const retrievals = events.filter((e) => e.type === 'retrieval');
		const answers = events.filter((e) => e.type === 'answer');
		const utterances = events.filter((e) => e.type === 'utterance');
		expect(events.filter((e) => e.type === 'error')).toEqual([]);
		// Segments 1+2 merge (100ms gap); 3 and the final question stand alone.
		expect(utterances).toHaveLength(3);
		expect(retrievals).toHaveLength(1);
		expect(answers).toHaveLength(1);

		// The question was classified as such and the answer is grounded.
		const question = utterances.find((u) => u.kind === 'question');
		expect(question?.utterance.text).toContain('ACID properties');
		const answer = answers[0]!;
		expect(answer.draft.sourceIds).toContain('th-acid');
		expect(answer.utteranceId).toBe(question?.utterance.id);

		// Everything landed in the session log too.
		const record = await sessionLog.getSession(orchestrator.sessionId!);
		expect(record?.utterances).toHaveLength(3);
		expect(record?.retrievals).toHaveLength(1);
		expect(record?.answers).toHaveLength(1);
	});

	it('a statements-only fixture triggers no retrieval but extends the window', async () => {
		const { events, sessionLog, orchestrator } = await runFixture(
			statementFixture.segments as TranscriptSegment[]
		);
		expect(events.filter((e) => e.type === 'retrieval')).toHaveLength(0);
		expect(events.filter((e) => e.type === 'answer')).toHaveLength(0);
		const utterances = events.filter((e) => e.type === 'utterance');
		// Segments 1+2 merge (100ms gap); 3 and 4 are separated by >700ms gaps.
		expect(utterances).toHaveLength(3);
		expect(utterances.every((u) => u.kind === 'statement')).toBe(true);
		const record = await sessionLog.getSession(orchestrator.sessionId!);
		expect(record?.utterances.map((u) => u.kind)).toEqual([
			'statement',
			'statement',
			'statement'
		]);
	});

	it('retrieval query includes preceding dialogue, not just the question', async () => {
		const harness = await makeOrchestrator();
		await harness.orchestrator.start();
		harness.transcription.emit({
			text: 'We rely heavily on caching.',
			startMs: 0,
			endMs: 1500,
			final: true
		});
		harness.transcription.emit({
			text: 'How would you invalidate it?',
			startMs: 3000,
			endMs: 4500,
			final: true
		});
		await harness.orchestrator.stop();
		const retrieval = harness.events.find((e) => e.type === 'retrieval');
		// "caching" only appears in the preceding statement; retrieval still finds be-caching.
		expect(retrieval?.docs.map((d) => d.doc.id)).toContain('be-caching');
	});

	it('emits an error event instead of throwing when a port fails', async () => {
		const harness = await makeOrchestrator();
		await harness.orchestrator.start();
		// Sabotage: retriever with an index bound to another model.
		const badIndex = new FakeVectorIndex();
		await badIndex.open({ model: 'other', dimensions: 1 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(harness.orchestrator as any).deps.retriever = new Retriever(
			{
				embeddings: new FakeEmbeddings(),
				index: badIndex,
				kb: new FakeKnowledgeBase(sampleKbDocs())
			},
			{ topK: 4 }
		);
		harness.transcription.emit({
			text: 'What is a closure?',
			startMs: 0,
			endMs: 1000,
			final: true
		});
		await harness.orchestrator.stop();
		expect(harness.events.some((e) => e.type === 'error')).toBe(true);
	});
});
