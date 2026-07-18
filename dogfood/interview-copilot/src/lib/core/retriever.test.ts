import { describe, expect, it } from 'vitest';
import { FakeEmbeddings } from '../../test/fakes/embeddings.fake.ts';
import { FakeKnowledgeBase, sampleKbDocs } from '../../test/fakes/knowledge-base.fake.ts';
import { FakeVectorIndex } from '../../test/fakes/vector-index.fake.ts';
import { IndexBindingMismatchError } from '../ports/vector-index.port.ts';
import { Retriever } from './retriever.ts';

function makeRetriever(topK = 4) {
	const embeddings = new FakeEmbeddings();
	const index = new FakeVectorIndex();
	const kb = new FakeKnowledgeBase(sampleKbDocs());
	const retriever = new Retriever({ embeddings, index, kb }, { topK });
	return { embeddings, index, kb, retriever };
}

describe('Retriever', () => {
	it('indexes the whole knowledge base and binds the index to the model', async () => {
		const { retriever, index, embeddings } = makeRetriever();
		const count = await retriever.indexKnowledgeBase();
		expect(count).toBe(sampleKbDocs().length);
		expect(await index.binding()).toEqual({
			model: embeddings.model,
			dimensions: embeddings.dimensions
		});
	});

	it('retrieves the semantically closest doc first', async () => {
		const { retriever } = makeRetriever();
		await retriever.indexKnowledgeBase();
		const docs = await retriever.retrieve(
			'Can you explain the ACID properties of a database transaction?'
		);
		expect(docs[0]!.doc.id).toBe('th-acid');
	});

	it('returns at most topK docs with scores in descending order', async () => {
		const { retriever } = makeRetriever(2);
		await retriever.indexKnowledgeBase();
		const docs = await retriever.retrieve('closures in javascript');
		expect(docs).toHaveLength(2);
		expect(docs[0]!.score).toBeGreaterThanOrEqual(docs[1]!.score);
	});

	it('refuses to retrieve against an index built by another model', async () => {
		const embeddings = new FakeEmbeddings();
		const index = new FakeVectorIndex();
		const kb = new FakeKnowledgeBase(sampleKbDocs());
		await index.open({ model: 'someone-else', dimensions: 999 });
		const retriever = new Retriever({ embeddings, index, kb }, { topK: 4 });
		await expect(retriever.retrieve('anything')).rejects.toBeInstanceOf(
			IndexBindingMismatchError
		);
	});
});
