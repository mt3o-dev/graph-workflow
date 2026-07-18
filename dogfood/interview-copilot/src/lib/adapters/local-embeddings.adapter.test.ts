import { describe, expect, it } from 'vitest';
import { describeEmbeddingsContract } from '../../test/contracts/embeddings.contract.ts';
import { LocalEmbeddingsAdapter } from './local-embeddings.adapter.ts';

describe('LocalEmbeddingsAdapter (offline behaviour)', () => {
	it('declares the MiniLM model with the shared 384-dim geometry [dec:3]', () => {
		const adapter = new LocalEmbeddingsAdapter();
		expect(adapter.model).toBe('Xenova/all-MiniLM-L6-v2');
		expect(adapter.dimensions).toBe(384);
	});

	it('constructing never loads the model, embed fails actionably when the optional dep is absent', async () => {
		// A bogus module id simulates the optional dependency being missing.
		const adapter = new LocalEmbeddingsAdapter({ moduleId: 'definitely-missing-module' });
		await expect(adapter.embed(['x'])).rejects.toThrow(/@huggingface\/transformers/);
	});
});

/**
 * Real-model contract run. Downloads Xenova/all-MiniLM-L6-v2 to the HF cache
 * on first run, so it is gated behind IC_TEST_ALLOW_MODEL_DOWNLOAD and skipped
 * in the default offline suite (the fake covers the port semantics).
 */
describeEmbeddingsContract('LocalEmbeddingsAdapter (real model)', () => new LocalEmbeddingsAdapter(), {
	skip: process.env.IC_TEST_ALLOW_MODEL_DOWNLOAD !== '1'
});
