import type { KbDoc } from './types.ts';

/** Read access to the question/answer knowledge base. */
export interface KnowledgeBasePort {
	listDocs(): Promise<KbDoc[]>;
	getDoc(id: string): Promise<KbDoc | null>;
}
