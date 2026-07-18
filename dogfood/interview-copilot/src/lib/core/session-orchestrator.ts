import type { SessionLogPort } from '../ports/session-log.port.ts';
import type { TranscriptionPort } from '../ports/transcription.port.ts';
import type {
	AnswerDraft,
	RetrievedDoc,
	TranscriptSegment,
	Unsubscribe,
	Utterance,
	UtteranceKind
} from '../ports/types.ts';
import { AnswerService } from './answer-service.ts';
import { ContextWindow } from './context-window.ts';
import type { QuestionClassifierPort } from './question-classifier.ts';
import { Retriever } from './retriever.ts';
import { TurnDetector } from './turn-detector.ts';

export type SessionEvent =
	| { type: 'utterance'; utterance: Utterance; kind: UtteranceKind }
	| { type: 'retrieval'; utteranceId: string; docs: RetrievedDoc[] }
	| { type: 'answer'; utteranceId: string; draft: AnswerDraft }
	| { type: 'error'; error: Error };

export interface SessionOrchestratorDeps {
	transcription: TranscriptionPort;
	classifier: QuestionClassifierPort;
	retriever: Retriever;
	answers: AnswerService;
	sessionLog: SessionLogPort;
}

export interface SessionOrchestratorOptions {
	silenceMs: number;
	maxSeconds: number;
	maxUtterances: number;
}

/**
 * Wires the pipeline: transcript segments → VAD turn detection → question
 * classification → (questions only) retrieval → grounded answer draft.
 * Statements only extend the context window [dec:7][dec:8].
 */
export class SessionOrchestrator {
	private readonly turnDetector: TurnDetector;
	private readonly window: ContextWindow;
	private readonly listeners = new Set<(event: SessionEvent) => void>();
	private unsubscribe: Unsubscribe | null = null;
	private queue: Promise<void> = Promise.resolve();
	private _sessionId: string | null = null;

	constructor(
		private readonly deps: SessionOrchestratorDeps,
		options: SessionOrchestratorOptions
	) {
		this.turnDetector = new TurnDetector({ silenceMs: options.silenceMs });
		this.window = new ContextWindow({
			maxSeconds: options.maxSeconds,
			maxUtterances: options.maxUtterances
		});
	}

	get sessionId(): string | null {
		return this._sessionId;
	}

	onEvent(listener: (event: SessionEvent) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async start(startedAtMs = 0): Promise<void> {
		this._sessionId = await this.deps.sessionLog.startSession(startedAtMs);
		this.unsubscribe = this.deps.transcription.onSegment((segment) => {
			this.enqueue(() => this.processSegment(segment));
		});
		await this.deps.transcription.start();
	}

	async stop(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.enqueue(async () => {
			const closed = this.turnDetector.flush();
			if (closed) await this.handleUtterance(closed);
		});
		await this.idle();
		await this.deps.transcription.stop();
	}

	/** Resolves when all queued segment processing has finished (test hook). */
	idle(): Promise<void> {
		return this.queue;
	}

	private enqueue(task: () => Promise<void>): void {
		this.queue = this.queue.then(task).catch((error: unknown) => {
			this.emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
		});
	}

	private async processSegment(segment: TranscriptSegment): Promise<void> {
		const closed = this.turnDetector.push(segment);
		if (closed) await this.handleUtterance(closed);
	}

	private async handleUtterance(utterance: Utterance): Promise<void> {
		const sessionId = this._sessionId;
		if (!sessionId) throw new Error('SessionOrchestrator not started');
		const kind: UtteranceKind = this.deps.classifier.isQuestion(utterance.text)
			? 'question'
			: 'statement';
		this.window.add(utterance);
		await this.deps.sessionLog.logUtterance(sessionId, utterance, kind);
		this.emit({ type: 'utterance', utterance, kind });
		if (kind !== 'question') return;

		// Retrieval query = the question plus preceding dialogue in the window [dec:7].
		const windowSnapshot = this.window.snapshot();
		const query = windowSnapshot.map((u) => u.text).join('\n');
		const docs = await this.deps.retriever.retrieve(query);
		await this.deps.sessionLog.logRetrieval(
			sessionId,
			utterance.id,
			docs.map((d) => ({ id: d.doc.id, score: d.score }))
		);
		this.emit({ type: 'retrieval', utteranceId: utterance.id, docs });

		const draft = await this.deps.answers.draft(utterance, windowSnapshot, docs);
		await this.deps.sessionLog.logAnswer(sessionId, utterance.id, draft);
		this.emit({ type: 'answer', utteranceId: utterance.id, draft });
	}

	private emit(event: SessionEvent): void {
		for (const listener of this.listeners) listener(event);
	}
}
