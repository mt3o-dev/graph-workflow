import type { AnswerPort } from '../ports/answer.port.ts';
import type { AnswerDraft, RetrievedDoc, Utterance } from '../ports/types.ts';

/**
 * Thin domain service over AnswerPort: forwards question + window + docs,
 * and clamps the returned source ids to the documents actually provided.
 */
export class AnswerService {
	constructor(private readonly answerPort: AnswerPort) {}

	async draft(
		question: Utterance,
		window: readonly Utterance[],
		docs: readonly RetrievedDoc[]
	): Promise<AnswerDraft> {
		const draft = await this.answerPort.draft({ question, window, docs });
		const known = new Set(docs.map((d) => d.doc.id));
		return {
			text: draft.text,
			sourceIds: draft.sourceIds.filter((id) => known.has(id))
		};
	}
}
