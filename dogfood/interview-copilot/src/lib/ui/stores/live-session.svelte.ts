/**
 * UI-side store for the Live Session screen.
 *
 * Drives a real `SessionOrchestrator` (core, unmodified) wired entirely to
 * in-memory fakes — there is no live audio/network path available on this
 * machine (PRD accepted gap), so "demo mode" plays back a recorded-transcript
 * fixture through a `FakeTranscription` port at its original timing. Swapping
 * the fakes for real adapters (via `createContainer`) is the seam a future
 * on-hardware pass uses; this store only ever talks to ports/core types.
 */
import { HeuristicQuestionClassifier } from '../../core/question-classifier.ts';
import { AnswerService } from '../../core/answer-service.ts';
import { ContextWindow } from '../../core/context-window.ts';
import { Retriever } from '../../core/retriever.ts';
import { SessionOrchestrator, type SessionEvent } from '../../core/session-orchestrator.ts';
import type { RetrievedDoc, TranscriptSegment, UtteranceKind } from '../../ports/types.ts';
import { FakeAnswer } from '../../../test/fakes/answer.fake.ts';
import { FakeEmbeddings } from '../../../test/fakes/embeddings.fake.ts';
import { FakeKnowledgeBase, sampleKbDocs } from '../../../test/fakes/knowledge-base.fake.ts';
import { FakeSessionLog } from '../../../test/fakes/session-log.fake.ts';
import { FakeTranscription } from '../../../test/fakes/transcription.fake.ts';
import { FakeVectorIndex } from '../../../test/fakes/vector-index.fake.ts';

export type Speaker = 'interviewer' | 'interviewee';

export interface TranscriptEntry {
	id: string;
	speaker: Speaker;
	text: string;
	timestampMs: number;
	kind: UtteranceKind;
	highlighted: boolean;
}

export interface AdapterStatus {
	sttAdapter: string;
	embeddingsAdapter: string;
	answerAdapter: string;
}

export interface LiveSessionOptions {
	/** Adapter names to display in the status indicators (read from config; display-only). */
	adapterStatus?: AdapterStatus;
	contextWindow?: { maxSeconds: number; maxUtterances: number };
	/** Milliseconds between fixture segments are scaled by this factor (1 = real time). */
	playbackSpeed?: number;
}

export interface TranscriptFixture {
	name: string;
	segments: TranscriptSegment[];
}

const DEMO_ADAPTER_STATUS: AdapterStatus = {
	sttAdapter: 'demo (recorded fixture)',
	embeddingsAdapter: 'fake-bag-of-words',
	answerAdapter: 'demo (deterministic)'
};

/** Reactive Svelte 5 store class for the Live Session screen. */
export class LiveSessionStore {
	status = $state<'idle' | 'running' | 'stopped'>('idle');
	transcript = $state<TranscriptEntry[]>([]);
	interimText = $state<string | null>(null);
	currentQuestion = $state<TranscriptEntry | null>(null);
	currentAnswer = $state<{ text: string; sources: RetrievedDoc[]; loading: boolean } | null>(null);
	contextWindowMeter = $state<{ utterances: number; maxUtterances: number; seconds: number; maxSeconds: number }>({
		utterances: 0,
		maxUtterances: 6,
		seconds: 0,
		maxSeconds: 30
	});
	readonly adapterStatus: AdapterStatus;
	error = $state<string | null>(null);

	private readonly windowMirror: ContextWindow;
	private readonly maxSeconds: number;
	private readonly maxUtterances: number;
	private readonly playbackSpeed: number;
	private orchestrator: SessionOrchestrator | null = null;
	private transcription: FakeTranscription | null = null;
	private timers: ReturnType<typeof setTimeout>[] = [];
	private readonly retrievedByUtterance = new Map<string, RetrievedDoc[]>();

	constructor(options: LiveSessionOptions = {}) {
		this.adapterStatus = options.adapterStatus ?? DEMO_ADAPTER_STATUS;
		this.maxSeconds = options.contextWindow?.maxSeconds ?? 30;
		this.maxUtterances = options.contextWindow?.maxUtterances ?? 6;
		this.playbackSpeed = options.playbackSpeed ?? 1;
		this.windowMirror = new ContextWindow({
			maxSeconds: this.maxSeconds,
			maxUtterances: this.maxUtterances
		});
	}

	/** Start (or restart) a demo session, replaying `fixture` through the orchestrator. */
	async start(fixture: TranscriptFixture): Promise<void> {
		this.stop();
		this.reset();

		const embeddings = new FakeEmbeddings();
		const index = new FakeVectorIndex();
		const kb = new FakeKnowledgeBase(sampleKbDocs());
		const transcription = new FakeTranscription();
		const sessionLog = new FakeSessionLog();
		const retriever = new Retriever({ embeddings, index, kb }, { topK: 4 });
		const orchestrator = new SessionOrchestrator(
			{
				transcription,
				classifier: new HeuristicQuestionClassifier(),
				retriever,
				answers: new AnswerService(new FakeAnswer()),
				sessionLog
			},
			{ silenceMs: 700, maxSeconds: this.maxSeconds, maxUtterances: this.maxUtterances }
		);

		this.transcription = transcription;
		this.orchestrator = orchestrator;
		orchestrator.onEvent((event) => this.handleEvent(event));

		await retriever.indexKnowledgeBase();
		await orchestrator.start();
		this.status = 'running';
		this.schedulePlayback(fixture, transcription);
	}

	/** Stop the session and cancel any pending scheduled playback. */
	stop(): void {
		for (const timer of this.timers) clearTimeout(timer);
		this.timers = [];
		if (this.orchestrator) {
			void this.orchestrator.stop();
		}
		this.orchestrator = null;
		this.transcription = null;
		if (this.status === 'running') this.status = 'stopped';
	}

	/** Clear all session state (transcript, answers, context window). */
	reset(): void {
		this.transcript = [];
		this.interimText = null;
		this.currentQuestion = null;
		this.currentAnswer = null;
		this.error = null;
		this.retrievedByUtterance.clear();
		this.windowMirror.clear();
		this.contextWindowMeter = {
			utterances: 0,
			maxUtterances: this.maxUtterances,
			seconds: 0,
			maxSeconds: this.maxSeconds
		};
		this.status = 'idle';
	}

	private schedulePlayback(fixture: TranscriptFixture, transcription: FakeTranscription): void {
		let lastDelay = 0;
		for (const segment of fixture.segments) {
			const delay = segment.startMs / this.playbackSpeed;
			lastDelay = Math.max(lastDelay, delay);
			const timer = setTimeout(() => {
				this.interimText = segment.final ? null : segment.text;
				transcription.emit(segment);
			}, delay);
			this.timers.push(timer);
		}
		// The turn detector only closes an utterance on the *next* segment's
		// silence gap (or on explicit stop). Auto-stop shortly after the last
		// fixture segment so a trailing question still gets flushed, retrieved
		// and answered without the user having to click "Stop".
		const endTimer = setTimeout(() => this.stop(), lastDelay + 300);
		this.timers.push(endTimer);
	}

	private handleEvent(event: SessionEvent): void {
		switch (event.type) {
			case 'utterance': {
				this.windowMirror.add(event.utterance);
				this.updateContextWindowMeter();
				const speaker: Speaker = event.kind === 'question' ? 'interviewer' : 'interviewee';
				const entry: TranscriptEntry = {
					id: event.utterance.id,
					speaker,
					text: event.utterance.text,
					timestampMs: event.utterance.startMs,
					kind: event.kind,
					highlighted: event.kind === 'question'
				};
				this.transcript = [...this.transcript, entry];
				this.interimText = null;
				if (event.kind === 'question') {
					this.currentQuestion = entry;
					this.currentAnswer = { text: '', sources: [], loading: true };
				}
				break;
			}
			case 'retrieval': {
				this.retrievedByUtterance.set(event.utteranceId, event.docs);
				break;
			}
			case 'answer': {
				const sources = this.retrievedByUtterance.get(event.utteranceId) ?? [];
				this.currentAnswer = { text: event.draft.text, sources, loading: false };
				break;
			}
			case 'error': {
				this.error = event.error.message;
				break;
			}
		}
	}

	private updateContextWindowMeter(): void {
		const snapshot = this.windowMirror.snapshot();
		const newest = snapshot.at(-1);
		const oldest = snapshot[0];
		const seconds = newest && oldest ? (newest.endMs - oldest.startMs) / 1000 : 0;
		this.contextWindowMeter = {
			utterances: snapshot.length,
			maxUtterances: this.maxUtterances,
			seconds,
			maxSeconds: this.maxSeconds
		};
	}
}
