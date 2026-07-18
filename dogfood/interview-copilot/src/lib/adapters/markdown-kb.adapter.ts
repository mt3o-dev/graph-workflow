import matter from 'gray-matter';
import type { KnowledgeBasePort } from '../ports/knowledge-base.port.ts';
import {
	KB_CATEGORIES,
	KB_DIFFICULTIES,
	KB_EXPERTISE,
	type KbCategory,
	type KbDifficulty,
	type KbDoc,
	type KbExpertise
} from '../ports/types.ts';

/** File access abstraction so tests can point the adapter anywhere. */
export interface KbFileSource {
	/** Paths of every markdown file in the KB. */
	listFiles(): Promise<string[]>;
	readFile(path: string): Promise<string>;
}

export interface KbParseResult {
	doc: KbDoc | null;
	errors: string[];
}

const includes = <T extends string>(haystack: readonly T[], value: unknown): value is T =>
	typeof value === 'string' && (haystack as readonly string[]).includes(value);

/**
 * Parses one markdown KB file (frontmatter + answer body) against the schema
 * [dec:10]: id, question, category, difficulty, expertise, tags[2-5];
 * non-empty body. Shared by the adapter and scripts/validate-kb.ts.
 */
export function parseKbDoc(content: string, filePath: string): KbParseResult {
	const errors: string[] = [];
	let data: Record<string, unknown>;
	let body: string;
	try {
		const parsed = matter(content);
		data = parsed.data as Record<string, unknown>;
		body = parsed.content.trim();
	} catch (error) {
		return { doc: null, errors: [`${filePath}: frontmatter parse failed: ${String(error)}`] };
	}

	const id = data.id;
	if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
		errors.push(`${filePath}: "id" must be a lowercase slug`);
	}
	if (typeof data.question !== 'string' || data.question.trim() === '') {
		errors.push(`${filePath}: "question" must be a non-empty string`);
	}
	if (!includes(KB_CATEGORIES, data.category)) {
		errors.push(`${filePath}: "category" must be one of ${KB_CATEGORIES.join('|')}`);
	}
	if (!includes(KB_DIFFICULTIES, data.difficulty)) {
		errors.push(`${filePath}: "difficulty" must be one of ${KB_DIFFICULTIES.join('|')}`);
	}
	if (!includes(KB_EXPERTISE, data.expertise)) {
		errors.push(`${filePath}: "expertise" must be one of ${KB_EXPERTISE.join('|')}`);
	}
	const tags = data.tags;
	if (
		!Array.isArray(tags) ||
		tags.length < 2 ||
		tags.length > 5 ||
		!tags.every((t) => typeof t === 'string' && t.trim() !== '')
	) {
		errors.push(`${filePath}: "tags" must be an array of 2-5 non-empty strings`);
	}
	if (body === '') {
		errors.push(`${filePath}: body (the prepared answer) must be non-empty`);
	}
	if (errors.length > 0) return { doc: null, errors };
	return {
		doc: {
			id: id as string,
			question: (data.question as string).trim(),
			category: data.category as KbCategory,
			difficulty: data.difficulty as KbDifficulty,
			expertise: data.expertise as KbExpertise,
			tags: (tags as string[]).map((t) => t.trim()),
			answer: body
		},
		errors: []
	};
}

/**
 * KnowledgeBasePort over a directory of markdown files with frontmatter
 * [dec:10]. Invalid files fail loudly — the KB is a curated, validated asset.
 */
export class MarkdownKbAdapter implements KnowledgeBasePort {
	private cache: Map<string, KbDoc> | null = null;

	constructor(private readonly source: KbFileSource) {}

	async listDocs(): Promise<KbDoc[]> {
		return [...(await this.load()).values()];
	}

	async getDoc(id: string): Promise<KbDoc | null> {
		return (await this.load()).get(id) ?? null;
	}

	private async load(): Promise<Map<string, KbDoc>> {
		if (this.cache) return this.cache;
		const docs = new Map<string, KbDoc>();
		const errors: string[] = [];
		for (const path of await this.source.listFiles()) {
			const result = parseKbDoc(await this.source.readFile(path), path);
			if (!result.doc) {
				errors.push(...result.errors);
				continue;
			}
			if (docs.has(result.doc.id)) {
				errors.push(`${path}: duplicate id "${result.doc.id}"`);
				continue;
			}
			docs.set(result.doc.id, result.doc);
		}
		if (errors.length > 0) {
			throw new Error(`Knowledge base is invalid:\n${errors.join('\n')}`);
		}
		this.cache = docs;
		return docs;
	}
}

/** Node-backed KbFileSource walking `dir` recursively for `.md` files (kb/README.md excluded). */
export async function createNodeKbSource(dir: string): Promise<KbFileSource> {
	const { readdir, readFile } = await import('node:fs/promises');
	const { join } = await import('node:path');
	return {
		async listFiles(): Promise<string[]> {
			const entries = await readdir(dir, { withFileTypes: true, recursive: true });
			return entries
				.filter(
					(e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md'
				)
				.map((e) => join(e.parentPath, e.name))
				.sort();
		},
		readFile: (path: string) => readFile(path, 'utf8')
	};
}
