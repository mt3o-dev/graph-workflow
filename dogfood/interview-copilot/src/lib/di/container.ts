import type { Database } from 'better-sqlite3';
import { AnthropicHaikuAnswerAdapter } from '../adapters/anthropic-haiku.adapter.ts';
import type { FetchLike } from '../adapters/http.types.ts';
import { LocalEmbeddingsAdapter } from '../adapters/local-embeddings.adapter.ts';
import {
	createNodeKbSource,
	MarkdownKbAdapter,
	type KbFileSource
} from '../adapters/markdown-kb.adapter.ts';
import { OpenAiEmbeddingsAdapter } from '../adapters/openai-embeddings.adapter.ts';
import { OpenAiSttAdapter } from '../adapters/openai-stt.adapter.ts';
import { createSqliteDb } from '../adapters/sqlite-db.ts';
import { SqliteSessionLogAdapter } from '../adapters/sqlite-session-log.adapter.ts';
import { SqliteVecIndexAdapter } from '../adapters/sqlite-vec-index.adapter.ts';
import type { WebSocketFactory } from '../adapters/websocket.types.ts';
import { WhisperLocalAdapter } from '../adapters/whisper-local.adapter.ts';
import { AnswerService } from '../core/answer-service.ts';
import {
	HeuristicQuestionClassifier,
	type QuestionClassifierPort
} from '../core/question-classifier.ts';
import { Retriever } from '../core/retriever.ts';
import { SessionOrchestrator } from '../core/session-orchestrator.ts';
import type { AnswerPort } from '../ports/answer.port.ts';
import type { ConfigPort } from '../ports/config.port.ts';
import type { EmbeddingsPort } from '../ports/embeddings.port.ts';
import type { KnowledgeBasePort } from '../ports/knowledge-base.port.ts';
import type { SessionLogPort } from '../ports/session-log.port.ts';
import type { TranscriptionPort } from '../ports/transcription.port.ts';
import type { VectorIndexPort } from '../ports/vector-index.port.ts';

export interface Container {
	config: ConfigPort;
	transcription: TranscriptionPort;
	embeddings: EmbeddingsPort;
	index: VectorIndexPort;
	kb: KnowledgeBasePort;
	answer: AnswerPort;
	sessionLog: SessionLogPort;
	classifier: QuestionClassifierPort;
	retriever: Retriever;
	answerService: AnswerService;
	orchestrator: SessionOrchestrator;
}

/**
 * External effects and pre-built ports. Network/GPU adapters are
 * constructor-injected [dec:2], so tests drop fakes in via `ports` and give
 * network adapters a scripted `fetchFn`/`wsFactory`.
 */
export interface ContainerDeps {
	fetchFn?: FetchLike;
	wsFactory?: WebSocketFactory;
	/** Reuse an existing DB handle (tests pass an in-memory one). */
	db?: Database;
	kbSource?: KbFileSource;
	ports?: Partial<
		Pick<
			Container,
			'transcription' | 'embeddings' | 'index' | 'kb' | 'answer' | 'sessionLog' | 'classifier'
		>
	>;
}

class UnknownAdapterError extends Error {
	constructor(key: string, value: string) {
		super(`Unknown ${key} adapter: "${value}"`);
		this.name = 'UnknownAdapterError';
	}
}

/**
 * Composition root [dec:2]: a typed factory that selects adapters from
 * config strings (`stt.adapter`, `embeddings.adapter`, `answer.adapter`,
 * `index.adapter`, `sessionLog.adapter`, `kb.adapter`) and wires the domain
 * core. No DI framework — the object graph is explicit.
 */
export async function createContainer(
	config: ConfigPort,
	deps: ContainerDeps = {}
): Promise<Container> {
	const needDb = async (): Promise<Database> =>
		(deps.db ??= await createSqliteDb(config.get<string>('db.file') ?? ':memory:'));

	const transcription =
		deps.ports?.transcription ?? buildTranscription(config, deps.wsFactory);
	const embeddings = deps.ports?.embeddings ?? buildEmbeddings(config, deps.fetchFn);
	const answer = deps.ports?.answer ?? buildAnswer(config, deps.fetchFn);

	let index = deps.ports?.index;
	if (!index) {
		const adapter = config.get<string>('index.adapter') ?? 'sqlite-vec';
		if (adapter !== 'sqlite-vec') throw new UnknownAdapterError('index', adapter);
		index = new SqliteVecIndexAdapter(await needDb());
	}

	let sessionLog = deps.ports?.sessionLog;
	if (!sessionLog) {
		const adapter = config.get<string>('sessionLog.adapter') ?? 'sqlite';
		if (adapter !== 'sqlite') throw new UnknownAdapterError('sessionLog', adapter);
		sessionLog = new SqliteSessionLogAdapter(await needDb());
	}

	let kb = deps.ports?.kb;
	if (!kb) {
		const adapter = config.get<string>('kb.adapter') ?? 'markdown';
		if (adapter !== 'markdown') throw new UnknownAdapterError('kb', adapter);
		const source = deps.kbSource ?? (await createNodeKbSource(config.get<string>('kb.dir') ?? 'kb'));
		kb = new MarkdownKbAdapter(source);
	}

	const classifier = deps.ports?.classifier ?? new HeuristicQuestionClassifier();
	const retriever = new Retriever(
		{ embeddings, index, kb },
		{ topK: config.get<number>('retrieval.topK') ?? 4 }
	);
	const answerService = new AnswerService(answer);
	const orchestrator = new SessionOrchestrator(
		{ transcription, classifier, retriever, answers: answerService, sessionLog },
		{
			silenceMs: config.get<number>('vad.silenceMs') ?? 700,
			maxSeconds: config.get<number>('contextWindow.maxSeconds') ?? 30,
			maxUtterances: config.get<number>('contextWindow.maxUtterances') ?? 6
		}
	);

	return {
		config,
		transcription,
		embeddings,
		index,
		kb,
		answer,
		sessionLog,
		classifier,
		retriever,
		answerService,
		orchestrator
	};
}

function buildTranscription(
	config: ConfigPort,
	wsFactory: WebSocketFactory | undefined
): TranscriptionPort {
	const adapter = config.get<string>('stt.adapter') ?? 'whisper-local';
	switch (adapter) {
		case 'whisper-local':
			return new WhisperLocalAdapter({
				url: config.get<string>('stt.whisper.url') ?? 'ws://localhost:9090',
				language: config.get<string>('stt.whisper.language'),
				model: config.get<string>('stt.whisper.model'),
				wsFactory
			});
		case 'openai':
			return new OpenAiSttAdapter({
				apiKey: config.get<string>('stt.openai.apiKey') ?? '',
				url: config.get<string>('stt.openai.url'),
				model: config.get<string>('stt.openai.model'),
				wsFactory
			});
		default:
			throw new UnknownAdapterError('stt', adapter);
	}
}

function buildEmbeddings(config: ConfigPort, fetchFn: FetchLike | undefined): EmbeddingsPort {
	const adapter = config.get<string>('embeddings.adapter') ?? 'local';
	switch (adapter) {
		case 'local':
			return new LocalEmbeddingsAdapter();
		case 'openai':
			return new OpenAiEmbeddingsAdapter({
				apiKey: config.get<string>('embeddings.openai.apiKey') ?? '',
				baseUrl: config.get<string>('embeddings.openai.baseUrl'),
				fetchFn
			});
		default:
			throw new UnknownAdapterError('embeddings', adapter);
	}
}

function buildAnswer(config: ConfigPort, fetchFn: FetchLike | undefined): AnswerPort {
	const adapter = config.get<string>('answer.adapter') ?? 'anthropic';
	switch (adapter) {
		case 'anthropic':
			return new AnthropicHaikuAnswerAdapter({
				apiKey: config.get<string>('answer.anthropic.apiKey') ?? '',
				model: config.get<string>('answer.anthropic.model'),
				baseUrl: config.get<string>('answer.anthropic.baseUrl'),
				maxTokens: config.get<number>('answer.anthropic.maxTokens'),
				fetchFn
			});
		default:
			throw new UnknownAdapterError('answer', adapter);
	}
}
