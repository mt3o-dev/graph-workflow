import type { EmbeddingsPort } from '../ports/embeddings.port.ts';

const DEFAULT_MODULE_ID = '@huggingface/transformers';

interface FeatureExtractionPipeline {
	(texts: readonly string[], options: { pooling: 'mean'; normalize: boolean }): Promise<{
		tolist(): number[][];
	}>;
}

interface TransformersModule {
	pipeline(task: 'feature-extraction', model: string): Promise<FeatureExtractionPipeline>;
}

/**
 * Local embeddings via transformers.js running Xenova/all-MiniLM-L6-v2
 * (384-dim) [dec:3]. The heavy module is lazy-imported on first `embed`, so
 * simply constructing the adapter (or running the unit suite, which uses
 * fakes) never loads the model. `@huggingface/transformers` is an optional
 * install: when absent, `embed` fails with an actionable error.
 */
export class LocalEmbeddingsAdapter implements EmbeddingsPort {
	readonly model = 'Xenova/all-MiniLM-L6-v2';
	readonly dimensions = 384;
	private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

	constructor(private readonly options: { moduleId?: string } = {}) {}

	private load(): Promise<FeatureExtractionPipeline> {
		this.pipelinePromise ??= (async () => {
			const moduleId = this.options.moduleId ?? DEFAULT_MODULE_ID;
			let mod: TransformersModule;
			try {
				mod = (await import(/* @vite-ignore */ moduleId)) as TransformersModule;
			} catch (cause) {
				this.pipelinePromise = null;
				throw new Error(
					`Local embeddings need the optional dependency "${DEFAULT_MODULE_ID}". ` +
						`Install it with: pnpm add ${DEFAULT_MODULE_ID} ` +
						`(or set embeddings.adapter to "openai" / a fake).`,
					{ cause }
				);
			}
			return mod.pipeline('feature-extraction', this.model);
		})();
		return this.pipelinePromise;
	}

	async embed(texts: readonly string[]): Promise<number[][]> {
		const pipeline = await this.load();
		const output = await pipeline(texts, { pooling: 'mean', normalize: true });
		return output.tolist();
	}
}
