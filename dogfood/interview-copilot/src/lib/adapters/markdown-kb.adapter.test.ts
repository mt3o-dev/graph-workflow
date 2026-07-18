import { describe, expect, it } from 'vitest';
import { describeKnowledgeBaseContract } from '../../test/contracts/knowledge-base.contract.ts';
import { MarkdownKbAdapter, parseKbDoc, type KbFileSource } from './markdown-kb.adapter.ts';

const VALID_ACID = `---
id: th-acid
question: "Explain the ACID properties of a database transaction."
category: theory
difficulty: medium
expertise: mid
tags: [databases, transactions, acid]
---

Atomicity, consistency, isolation and durability are the transaction guarantees.
`;

const VALID_CLOSURES = `---
id: fe-closures
question: "What is a closure in JavaScript?"
category: frontend
difficulty: easy
expertise: junior
tags: [javascript, closures]
---

A closure is a function that captures variables from its lexical scope.
`;

function memorySource(files: Record<string, string>): KbFileSource {
	return {
		listFiles: async () => Object.keys(files).sort(),
		readFile: async (path) => files[path]!
	};
}

describeKnowledgeBaseContract('MarkdownKbAdapter (in-memory files)', () => {
	return new MarkdownKbAdapter(
		memorySource({ 'kb/theory/th-acid.md': VALID_ACID, 'kb/frontend/fe-closures.md': VALID_CLOSURES })
	);
});

describe('parseKbDoc schema validation [dec:10]', () => {
	it('parses a valid file into a KbDoc with the body as the answer', () => {
		const { doc, errors } = parseKbDoc(VALID_ACID, 'th-acid.md');
		expect(errors).toEqual([]);
		expect(doc).toMatchObject({
			id: 'th-acid',
			category: 'theory',
			difficulty: 'medium',
			expertise: 'mid',
			tags: ['databases', 'transactions', 'acid']
		});
		expect(doc!.answer).toContain('Atomicity');
	});

	it.each([
		['id: "Bad Slug!"', /"id" must be a lowercase slug/],
		['question: ""', /"question" must be a non-empty string/],
		['category: devops', /"category" must be one of/],
		['difficulty: impossible', /"difficulty" must be one of/],
		['expertise: expert', /"expertise" must be one of/],
		['tags: [one]', /"tags" must be an array of 2-5/],
		['tags: [a, b, c, d, e, f]', /"tags" must be an array of 2-5/]
	])('rejects %s', (override, expected) => {
		const [key] = override.split(':');
		const mutated = VALID_ACID.replace(new RegExp(`^${key}:.*$`, 'm'), override);
		const { doc, errors } = parseKbDoc(mutated, 'mutated.md');
		expect(doc).toBeNull();
		expect(errors.join('\n')).toMatch(expected);
	});

	it('rejects an empty body (missing prepared answer)', () => {
		const headerOnly = VALID_ACID.slice(0, VALID_ACID.lastIndexOf('---') + 3);
		const { doc, errors } = parseKbDoc(headerOnly, 'empty.md');
		expect(doc).toBeNull();
		expect(errors.join('\n')).toMatch(/body .* non-empty/);
	});
});

describe('MarkdownKbAdapter error handling', () => {
	it('fails loudly on duplicate ids', async () => {
		const adapter = new MarkdownKbAdapter(
			memorySource({ 'a.md': VALID_ACID, 'b.md': VALID_ACID })
		);
		await expect(adapter.listDocs()).rejects.toThrow(/duplicate id "th-acid"/);
	});

	it('fails loudly on schema-invalid files', async () => {
		const adapter = new MarkdownKbAdapter(
			memorySource({ 'bad.md': '---\nid: x\n---\n\nno schema here\n' })
		);
		await expect(adapter.listDocs()).rejects.toThrow(/Knowledge base is invalid/);
	});
});
