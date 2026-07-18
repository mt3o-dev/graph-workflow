import type { EmbeddingsPort } from '../ports/embeddings.port.ts';
import type { KnowledgeBasePort } from '../ports/knowledge-base.port.ts';
import type { RetrievedDoc } from '../ports/types.ts';
import type { VectorIndexPort } from '../ports/vector-index.port.ts';

export interface RetrieverOptions {
	/** Number of documents to retrieve. Default 4. */
	topK: number;
}

export interface RetrieverDeps {
	embeddings: EmbeddingsPort;
	index: VectorIndexPort;
	kb: KnowledgeBasePort;
}

/** Embeds a query and returns the top-k knowledge-base documents by cosine similarity. */
export class Retriever {
	constructor(
		private readonly deps: RetrieverDeps,
		private readonly options: RetrieverOptions
	) {}

	/**
	 * (Re)index the whole knowledge base. Opens the index with the current
	 * embedding model's binding (which refuses a mismatched existing index).
	 * Returns the number of indexed documents.
	 */
	async indexKnowledgeBase(): Promise<number> {
		const { embeddings, index, kb } = this.deps;
		await index.open({ model: embeddings.model, dimensions: embeddings.dimensions });
		const docs = await kb.listDocs();
		if (docs.length === 0) return 0;
		const vectors = await embeddings.embed(docs.map((d) => `${d.question}\n${d.answer}`));
		await index.upsert(docs.map((d, i) => ({ id: d.id, vector: vectors[i]! })));
		return docs.length;
	}

	async retrieve(query: string): Promise<RetrievedDoc[]> {
		const { embeddings, index, kb } = this.deps;
		await index.open({ model: embeddings.model, dimensions: embeddings.dimensions });
		const [vector] = await embeddings.embed([query]);
		const hits = await index.query(vector!, this.options.topK);
		const docs: RetrievedDoc[] = [];
		for (const hit of hits) {
			const doc = await kb.getDoc(hit.id);
			if (doc) docs.push({ doc, score: hit.score });
		}
		return docs;
	}
}
