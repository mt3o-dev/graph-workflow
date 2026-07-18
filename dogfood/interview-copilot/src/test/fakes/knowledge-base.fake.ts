import type { KnowledgeBasePort } from '../../lib/ports/knowledge-base.port.ts';
import type { KbDoc } from '../../lib/ports/types.ts';

/** In-memory KnowledgeBasePort seeded from an array of docs. */
export class FakeKnowledgeBase implements KnowledgeBasePort {
	constructor(private readonly docs: KbDoc[]) {}

	async listDocs(): Promise<KbDoc[]> {
		return [...this.docs];
	}

	async getDoc(id: string): Promise<KbDoc | null> {
		return this.docs.find((d) => d.id === id) ?? null;
	}
}

/** Small deterministic doc set used across tests. */
export function sampleKbDocs(): KbDoc[] {
	return [
		{
			id: 'th-acid',
			question: 'Explain the ACID properties of a database transaction.',
			category: 'theory',
			difficulty: 'medium',
			expertise: 'mid',
			tags: ['databases', 'transactions', 'acid'],
			answer:
				'Atomicity, consistency, isolation and durability are the transaction guarantees a database provides.'
		},
		{
			id: 'fe-closures',
			question: 'What is a closure in JavaScript?',
			category: 'frontend',
			difficulty: 'easy',
			expertise: 'junior',
			tags: ['javascript', 'closures'],
			answer: 'A closure is a function that captures variables from its lexical scope.'
		},
		{
			id: 'be-caching',
			question: 'What caching strategies do you know and when do you invalidate?',
			category: 'backend',
			difficulty: 'medium',
			expertise: 'mid',
			tags: ['caching', 'invalidation'],
			answer: 'Cache-aside, write-through and write-behind, with TTL or event-driven invalidation.'
		},
		{
			id: 'bh-conflict',
			question: 'Tell me about a conflict with a colleague.',
			category: 'behavioral',
			difficulty: 'medium',
			expertise: 'mid',
			tags: ['conflict', 'teamwork'],
			answer: 'Use the STAR structure: situation, task, action, result.'
		},
		{
			id: 'th-cap',
			question: 'Explain the CAP theorem.',
			category: 'theory',
			difficulty: 'medium',
			expertise: 'mid',
			tags: ['distributed-systems', 'cap-theorem'],
			answer: 'Under a network partition a distributed system chooses consistency or availability.'
		}
	];
}
