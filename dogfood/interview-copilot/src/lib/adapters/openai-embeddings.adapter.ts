import type { EmbeddingsPort } from '../ports/embeddings.port.ts';
import { globalFetch, type FetchLike } from './http.types.ts';

export interface OpenAiEmbeddingsOptions {
	apiKey: string;
	baseUrl?: string;
	fetchFn?: FetchLike;
}

interface EmbeddingsResponse {
	data: Array<{ index: number; embedding: number[] }>;
}

/**
 * OpenAI `text-embedding-3-small` truncated to 384 dimensions via the
 * `dimensions` parameter [dec:3], so the online adapter shares one index
 * geometry with the local MiniLM adapter.
 */
export class OpenAiEmbeddingsAdapter implements EmbeddingsPort {
	readonly model = 'text-embedding-3-small';
	readonly dimensions = 384;
	private readonly fetchFn: FetchLike;
	private readonly baseUrl: string;

	constructor(private readonly options: OpenAiEmbeddingsOptions) {
		this.fetchFn = options.fetchFn ?? globalFetch;
		this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
	}

	async embed(texts: readonly string[]): Promise<number[][]> {
		const response = await this.fetchFn(`${this.baseUrl}/embeddings`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${this.options.apiKey}`
			},
			body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dimensions })
		});
		if (!response.ok) {
			throw new Error(`OpenAI embeddings request failed (${response.status}): ${await response.text()}`);
		}
		const payload = (await response.json()) as EmbeddingsResponse;
		return payload.data
			.slice()
			.sort((a, b) => a.index - b.index)
			.map((d) => d.embedding);
	}
}
