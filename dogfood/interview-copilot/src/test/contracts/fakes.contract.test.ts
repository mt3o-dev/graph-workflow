/**
 * Runs every shared port-contract suite against the in-memory fakes,
 * guaranteeing fakes and real adapters obey the same semantics.
 */
import { FakeAnswer } from '../fakes/answer.fake.ts';
import { FakeEmbeddings } from '../fakes/embeddings.fake.ts';
import { FakeKnowledgeBase, sampleKbDocs } from '../fakes/knowledge-base.fake.ts';
import { FakeSessionLog } from '../fakes/session-log.fake.ts';
import { FakeTranscription } from '../fakes/transcription.fake.ts';
import { FakeVectorIndex } from '../fakes/vector-index.fake.ts';
import { describeAnswerContract } from './answer.contract.ts';
import { describeEmbeddingsContract } from './embeddings.contract.ts';
import { describeKnowledgeBaseContract } from './knowledge-base.contract.ts';
import { describeSessionLogContract } from './session-log.contract.ts';
import { describeTranscriptionContract } from './transcription.contract.ts';
import { describeVectorIndexContract } from './vector-index.contract.ts';

describeEmbeddingsContract('FakeEmbeddings', () => new FakeEmbeddings());
describeVectorIndexContract('FakeVectorIndex', () => new FakeVectorIndex());
describeSessionLogContract('FakeSessionLog', () => new FakeSessionLog());
describeKnowledgeBaseContract('FakeKnowledgeBase', () => new FakeKnowledgeBase(sampleKbDocs()));
describeAnswerContract('FakeAnswer', () => new FakeAnswer());
describeTranscriptionContract('FakeTranscription', () => {
	const port = new FakeTranscription();
	let counter = 0;
	return {
		port,
		pushTranscript(text: string) {
			counter += 1;
			port.emit({ text, startMs: counter * 2000, endMs: counter * 2000 + 1000, final: true });
		}
	};
});
