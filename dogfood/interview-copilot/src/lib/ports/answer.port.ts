import type { AnswerDraft, RetrievedDoc, Utterance } from './types.ts';

export interface AnswerRequest {
	/** The detected question utterance. */
	question: Utterance;
	/** The surrounding transcript context window (question included, last). */
	window: readonly Utterance[];
	/** Retrieved knowledge-base documents to ground the draft in. */
	docs: readonly RetrievedDoc[];
}

/** Draft-answer generation (LLM). Swapping models is a config change. */
export interface AnswerPort {
	draft(request: AnswerRequest): Promise<AnswerDraft>;
}
