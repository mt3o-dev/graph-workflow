import type { SessionLogPort, SessionRecord } from '../../lib/ports/session-log.port.ts';
import type { AnswerDraft, Utterance, UtteranceKind } from '../../lib/ports/types.ts';

/** In-memory SessionLogPort. */
export class FakeSessionLog implements SessionLogPort {
	private readonly sessions = new Map<string, SessionRecord>();
	private counter = 0;

	async startSession(startedAtMs: number): Promise<string> {
		this.counter += 1;
		const id = `session-${this.counter}`;
		this.sessions.set(id, { id, startedAtMs, utterances: [], retrievals: [], answers: [] });
		return id;
	}

	async logUtterance(sessionId: string, utterance: Utterance, kind: UtteranceKind): Promise<void> {
		this.session(sessionId).utterances.push({ utterance, kind });
	}

	async logRetrieval(
		sessionId: string,
		utteranceId: string,
		results: ReadonlyArray<{ id: string; score: number }>
	): Promise<void> {
		this.session(sessionId).retrievals.push({ utteranceId, results: [...results] });
	}

	async logAnswer(sessionId: string, utteranceId: string, draft: AnswerDraft): Promise<void> {
		this.session(sessionId).answers.push({ utteranceId, draft });
	}

	async getSession(sessionId: string): Promise<SessionRecord | null> {
		return this.sessions.get(sessionId) ?? null;
	}

	async listSessions(): Promise<Array<{ id: string; startedAtMs: number }>> {
		return [...this.sessions.values()].map(({ id, startedAtMs }) => ({ id, startedAtMs }));
	}

	private session(sessionId: string): SessionRecord {
		const record = this.sessions.get(sessionId);
		if (!record) throw new Error(`Unknown session: ${sessionId}`);
		return record;
	}
}
