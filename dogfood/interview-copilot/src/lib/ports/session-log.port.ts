import type { AnswerDraft, Utterance, UtteranceKind } from './types.ts';

export interface LoggedUtterance {
	utterance: Utterance;
	kind: UtteranceKind;
}

export interface LoggedRetrieval {
	utteranceId: string;
	results: Array<{ id: string; score: number }>;
}

export interface LoggedAnswer {
	utteranceId: string;
	draft: AnswerDraft;
}

export interface SessionRecord {
	id: string;
	startedAtMs: number;
	utterances: LoggedUtterance[];
	retrievals: LoggedRetrieval[];
	answers: LoggedAnswer[];
}

/** Durable per-session history of utterances, retrievals and answers. */
export interface SessionLogPort {
	/** Returns the new session id. */
	startSession(startedAtMs: number): Promise<string>;
	logUtterance(sessionId: string, utterance: Utterance, kind: UtteranceKind): Promise<void>;
	logRetrieval(
		sessionId: string,
		utteranceId: string,
		results: ReadonlyArray<{ id: string; score: number }>
	): Promise<void>;
	logAnswer(sessionId: string, utteranceId: string, draft: AnswerDraft): Promise<void>;
	getSession(sessionId: string): Promise<SessionRecord | null>;
	listSessions(): Promise<Array<{ id: string; startedAtMs: number }>>;
}
