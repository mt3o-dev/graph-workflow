import type { AnswerPort, AnswerRequest } from '../../lib/ports/answer.port.ts';
import type { AnswerDraft } from '../../lib/ports/types.ts';

/** Deterministic AnswerPort: echoes the question and cites every retrieved doc. */
export class FakeAnswer implements AnswerPort {
	readonly requests: AnswerRequest[] = [];

	async draft(request: AnswerRequest): Promise<AnswerDraft> {
		this.requests.push(request);
		const sourceIds = request.docs.map((d) => d.doc.id);
		return {
			text: `Draft answer for: ${request.question.text} (grounded in ${sourceIds.length} docs)`,
			sourceIds
		};
	}
}
