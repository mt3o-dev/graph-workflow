/**
 * Shared domain types used by ports and core.
 * Pure TypeScript — no runtime dependencies.
 */

/** A raw piece of transcript emitted by a TranscriptionPort. */
export interface TranscriptSegment {
	text: string;
	/** Milliseconds from session start. */
	startMs: number;
	endMs: number;
	/** Interim segments may be revised; final segments are stable. */
	final: boolean;
}

/** A VAD-closed turn: one or more consecutive final segments. */
export interface Utterance {
	id: string;
	text: string;
	startMs: number;
	endMs: number;
}

export type UtteranceKind = 'question' | 'statement';

export type KbCategory = 'frontend' | 'backend' | 'theory' | 'behavioral';
export type KbDifficulty = 'easy' | 'medium' | 'hard';
export type KbExpertise = 'junior' | 'mid' | 'senior';

export const KB_CATEGORIES: readonly KbCategory[] = ['frontend', 'backend', 'theory', 'behavioral'];
export const KB_DIFFICULTIES: readonly KbDifficulty[] = ['easy', 'medium', 'hard'];
export const KB_EXPERTISE: readonly KbExpertise[] = ['junior', 'mid', 'senior'];

/** One knowledge-base document: a question plus its prepared answer. */
export interface KbDoc {
	id: string;
	question: string;
	category: KbCategory;
	difficulty: KbDifficulty;
	expertise: KbExpertise;
	tags: string[];
	/** Markdown body = the prepared answer. */
	answer: string;
}

export interface RetrievedDoc {
	doc: KbDoc;
	/** Cosine similarity in [-1, 1]; higher is closer. */
	score: number;
}

export interface AnswerDraft {
	text: string;
	/** Ids of KbDocs the draft is grounded in (subset of the retrieved docs). */
	sourceIds: string[];
}

/** The embedding model geometry an index is bound to. */
export interface IndexBinding {
	model: string;
	dimensions: number;
}

export type Unsubscribe = () => void;
