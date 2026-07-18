import { describe, expect, it } from 'vitest';
import { AnthropicHaikuAnswerAdapter } from '../adapters/anthropic-haiku.adapter.ts';
import { LocalEmbeddingsAdapter } from '../adapters/local-embeddings.adapter.ts';
import { MarkdownKbAdapter } from '../adapters/markdown-kb.adapter.ts';
import { OpenAiEmbeddingsAdapter } from '../adapters/openai-embeddings.adapter.ts';
import { OpenAiSttAdapter } from '../adapters/openai-stt.adapter.ts';
import { createSqliteDb } from '../adapters/sqlite-db.ts';
import { SqliteSessionLogAdapter } from '../adapters/sqlite-session-log.adapter.ts';
import { SqliteVecIndexAdapter } from '../adapters/sqlite-vec-index.adapter.ts';
import { WhisperLocalAdapter } from '../adapters/whisper-local.adapter.ts';
import { SessionOrchestrator } from '../core/session-orchestrator.ts';
import { FakeConfig } from '../../test/fakes/config.fake.ts';
import { FakeEmbeddings } from '../../test/fakes/embeddings.fake.ts';
import { FakeKnowledgeBase, sampleKbDocs } from '../../test/fakes/knowledge-base.fake.ts';
import { FakeTranscription } from '../../test/fakes/transcription.fake.ts';
import { FakeVectorIndex } from '../../test/fakes/vector-index.fake.ts';
import { createContainer } from './container.ts';

const KB_SOURCE = {
	listFiles: async () => [],
	readFile: async () => ''
};

const baseConfig = {
	stt: { adapter: 'whisper-local', whisper: { url: 'ws://localhost:9090' } },
	embeddings: { adapter: 'local' },
	answer: { adapter: 'anthropic', anthropic: { apiKey: 'k' } },
	index: { adapter: 'sqlite-vec' },
	sessionLog: { adapter: 'sqlite' },
	kb: { adapter: 'markdown' },
	db: { file: ':memory:' },
	vad: { silenceMs: 700 },
	contextWindow: { maxSeconds: 30, maxUtterances: 6 },
	retrieval: { topK: 4 }
};

describe('createContainer [dec:2] selects adapters from config strings', () => {
	it('wires the default local stack', async () => {
		const container = await createContainer(new FakeConfig(baseConfig), {
			db: await createSqliteDb(':memory:'),
			kbSource: KB_SOURCE
		});
		expect(container.transcription).toBeInstanceOf(WhisperLocalAdapter);
		expect(container.embeddings).toBeInstanceOf(LocalEmbeddingsAdapter);
		expect(container.answer).toBeInstanceOf(AnthropicHaikuAnswerAdapter);
		expect(container.index).toBeInstanceOf(SqliteVecIndexAdapter);
		expect(container.sessionLog).toBeInstanceOf(SqliteSessionLogAdapter);
		expect(container.kb).toBeInstanceOf(MarkdownKbAdapter);
		expect(container.orchestrator).toBeInstanceOf(SessionOrchestrator);
	});

	it('switches adapters when config strings change — no code change [dec:9]', async () => {
		const config = new FakeConfig({
			...baseConfig,
			stt: { adapter: 'openai', openai: { apiKey: 'k' } },
			embeddings: { adapter: 'openai', openai: { apiKey: 'k' } }
		});
		const container = await createContainer(config, {
			db: await createSqliteDb(':memory:'),
			kbSource: KB_SOURCE
		});
		expect(container.transcription).toBeInstanceOf(OpenAiSttAdapter);
		expect(container.embeddings).toBeInstanceOf(OpenAiEmbeddingsAdapter);
	});

	it('accepts injected fake ports (tests drop fakes in) and runs end-to-end', async () => {
		const transcription = new FakeTranscription();
		const container = await createContainer(new FakeConfig(baseConfig), {
			db: await createSqliteDb(':memory:'),
			ports: {
				transcription,
				embeddings: new FakeEmbeddings(),
				index: new FakeVectorIndex(),
				kb: new FakeKnowledgeBase(sampleKbDocs()),
				answer: { draft: async () => ({ text: 'stub', sourceIds: [] }) }
			}
		});
		await container.retriever.indexKnowledgeBase();
		await container.orchestrator.start();
		transcription.emit({ text: 'What is a closure?', startMs: 0, endMs: 900, final: true });
		await container.orchestrator.stop();
		const record = await container.sessionLog.getSession(container.orchestrator.sessionId!);
		expect(record!.retrievals).toHaveLength(1);
		expect(record!.answers[0]!.draft.text).toBe('stub');
	});

	it('rejects unknown adapter names', async () => {
		const config = new FakeConfig({ ...baseConfig, embeddings: { adapter: 'quantum' } });
		await expect(
			createContainer(config, { db: await createSqliteDb(':memory:'), kbSource: KB_SOURCE })
		).rejects.toThrow(/Unknown embeddings adapter: "quantum"/);
	});
});
