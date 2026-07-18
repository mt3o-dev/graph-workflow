import type { AnswerPort, AnswerRequest } from '../ports/answer.port.ts';
import type { AnswerDraft } from '../ports/types.ts';
import { globalFetch, type FetchLike } from './http.types.ts';

export interface AnthropicHaikuOptions {
	apiKey: string;
	model?: string;
	baseUrl?: string;
	maxTokens?: number;
	fetchFn?: FetchLike;
}

interface MessagesResponse {
	content: Array<{ type: string; text?: string }>;
}

/**
 * AnswerPort adapter for Anthropic `claude-haiku-4-5` [dec:6]. Sends the
 * context window, the retrieved docs (tagged by id) and the question; asks
 * the model to cite sources as [doc-id]. Source ids are extracted from the
 * draft and clamped to the provided documents.
 */
export class AnthropicHaikuAnswerAdapter implements AnswerPort {
	private readonly fetchFn: FetchLike;
	private readonly model: string;
	private readonly baseUrl: string;
	private readonly maxTokens: number;

	constructor(private readonly options: AnthropicHaikuOptions) {
		this.fetchFn = options.fetchFn ?? globalFetch;
		this.model = options.model ?? 'claude-haiku-4-5';
		this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
		this.maxTokens = options.maxTokens ?? 512;
	}

	async draft(request: AnswerRequest): Promise<AnswerDraft> {
		const response = await this.fetchFn(`${this.baseUrl}/v1/messages`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': this.options.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: this.model,
				max_tokens: this.maxTokens,
				system:
					'You are an interview copilot. Draft a concise first-person answer to the ' +
					'interview question, grounded ONLY in the provided source documents. ' +
					'Cite every document you use inline as [doc-id]. If no document applies, say so.',
				messages: [{ role: 'user', content: this.buildPrompt(request) }]
			})
		});
		if (!response.ok) {
			throw new Error(`Anthropic request failed (${response.status}): ${await response.text()}`);
		}
		const payload = (await response.json()) as MessagesResponse;
		const text = payload.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text ?? '')
			.join('')
			.trim();
		return { text, sourceIds: this.citedIds(text, request) };
	}

	private buildPrompt(request: AnswerRequest): string {
		const transcript = request.window.map((u) => `- ${u.text}`).join('\n');
		const docs = request.docs
			.map((d) => `[${d.doc.id}] Q: ${d.doc.question}\nA: ${d.doc.answer}`)
			.join('\n\n');
		return (
			`Transcript context (most recent last):\n${transcript}\n\n` +
			`Source documents:\n${docs || '(none retrieved)'}\n\n` +
			`Interview question: ${request.question.text}`
		);
	}

	private citedIds(text: string, request: AnswerRequest): string[] {
		return request.docs.map((d) => d.doc.id).filter((id) => text.includes(`[${id}]`));
	}
}
