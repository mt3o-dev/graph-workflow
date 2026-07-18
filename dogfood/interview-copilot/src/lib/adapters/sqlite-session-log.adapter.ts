import type { Database } from 'better-sqlite3';
import type { SessionLogPort, SessionRecord } from '../ports/session-log.port.ts';
import type { AnswerDraft, Utterance, UtteranceKind } from '../ports/types.ts';

/**
 * SessionLogPort on better-sqlite3 [dec:12]. Lives in the same DB file as
 * the vector index (separate tables); the Rust shell does not own the schema.
 */
export class SqliteSessionLogAdapter implements SessionLogPort {
	private counter = 0;

	constructor(private readonly db: Database) {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				started_at_ms INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS session_utterances (
				session_id TEXT NOT NULL REFERENCES sessions(id),
				utterance_id TEXT NOT NULL,
				kind TEXT NOT NULL CHECK (kind IN ('question','statement')),
				text TEXT NOT NULL,
				start_ms INTEGER NOT NULL,
				end_ms INTEGER NOT NULL,
				seq INTEGER PRIMARY KEY AUTOINCREMENT
			);
			CREATE TABLE IF NOT EXISTS session_retrievals (
				session_id TEXT NOT NULL REFERENCES sessions(id),
				utterance_id TEXT NOT NULL,
				results_json TEXT NOT NULL,
				seq INTEGER PRIMARY KEY AUTOINCREMENT
			);
			CREATE TABLE IF NOT EXISTS session_answers (
				session_id TEXT NOT NULL REFERENCES sessions(id),
				utterance_id TEXT NOT NULL,
				text TEXT NOT NULL,
				source_ids_json TEXT NOT NULL,
				seq INTEGER PRIMARY KEY AUTOINCREMENT
			);
		`);
	}

	async startSession(startedAtMs: number): Promise<string> {
		this.counter += 1;
		const id = `session-${Date.now()}-${this.counter}`;
		this.db.prepare('INSERT INTO sessions (id, started_at_ms) VALUES (?, ?)').run(id, startedAtMs);
		return id;
	}

	async logUtterance(sessionId: string, utterance: Utterance, kind: UtteranceKind): Promise<void> {
		this.db
			.prepare(
				'INSERT INTO session_utterances (session_id, utterance_id, kind, text, start_ms, end_ms) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(sessionId, utterance.id, kind, utterance.text, utterance.startMs, utterance.endMs);
	}

	async logRetrieval(
		sessionId: string,
		utteranceId: string,
		results: ReadonlyArray<{ id: string; score: number }>
	): Promise<void> {
		this.db
			.prepare(
				'INSERT INTO session_retrievals (session_id, utterance_id, results_json) VALUES (?, ?, ?)'
			)
			.run(sessionId, utteranceId, JSON.stringify(results));
	}

	async logAnswer(sessionId: string, utteranceId: string, draft: AnswerDraft): Promise<void> {
		this.db
			.prepare(
				'INSERT INTO session_answers (session_id, utterance_id, text, source_ids_json) VALUES (?, ?, ?, ?)'
			)
			.run(sessionId, utteranceId, draft.text, JSON.stringify(draft.sourceIds));
	}

	async getSession(sessionId: string): Promise<SessionRecord | null> {
		const session = this.db
			.prepare('SELECT id, started_at_ms FROM sessions WHERE id = ?')
			.get(sessionId) as { id: string; started_at_ms: number } | undefined;
		if (!session) return null;
		const utterances = this.db
			.prepare(
				'SELECT utterance_id, kind, text, start_ms, end_ms FROM session_utterances WHERE session_id = ? ORDER BY seq'
			)
			.all(sessionId) as Array<{
			utterance_id: string;
			kind: UtteranceKind;
			text: string;
			start_ms: number;
			end_ms: number;
		}>;
		const retrievals = this.db
			.prepare(
				'SELECT utterance_id, results_json FROM session_retrievals WHERE session_id = ? ORDER BY seq'
			)
			.all(sessionId) as Array<{ utterance_id: string; results_json: string }>;
		const answers = this.db
			.prepare(
				'SELECT utterance_id, text, source_ids_json FROM session_answers WHERE session_id = ? ORDER BY seq'
			)
			.all(sessionId) as Array<{ utterance_id: string; text: string; source_ids_json: string }>;
		return {
			id: session.id,
			startedAtMs: session.started_at_ms,
			utterances: utterances.map((row) => ({
				utterance: {
					id: row.utterance_id,
					text: row.text,
					startMs: row.start_ms,
					endMs: row.end_ms
				},
				kind: row.kind
			})),
			retrievals: retrievals.map((row) => ({
				utteranceId: row.utterance_id,
				results: JSON.parse(row.results_json) as Array<{ id: string; score: number }>
			})),
			answers: answers.map((row) => ({
				utteranceId: row.utterance_id,
				draft: {
					text: row.text,
					sourceIds: JSON.parse(row.source_ids_json) as string[]
				}
			}))
		};
	}

	async listSessions(): Promise<Array<{ id: string; startedAtMs: number }>> {
		const rows = this.db
			.prepare('SELECT id, started_at_ms FROM sessions ORDER BY rowid')
			.all() as Array<{ id: string; started_at_ms: number }>;
		return rows.map((row) => ({ id: row.id, startedAtMs: row.started_at_ms }));
	}
}
