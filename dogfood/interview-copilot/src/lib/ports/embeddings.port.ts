/** Text embedding provider. All adapters must emit the same geometry (384-dim). */
export interface EmbeddingsPort {
	/** Identifier recorded into the vector index binding. */
	readonly model: string;
	readonly dimensions: number;
	/** One vector per input text, `dimensions` numbers each. */
	embed(texts: readonly string[]): Promise<number[][]>;
}
