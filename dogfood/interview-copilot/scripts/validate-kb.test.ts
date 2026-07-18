import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateKb } from './validate-kb.ts';

const doc = (
	id: string,
	category: string,
	tags: string[],
	question = `Question ${id}?`
) => `---
id: ${id}
question: "${question}"
category: ${category}
difficulty: medium
expertise: mid
tags: [${tags.join(', ')}]
---

A prepared answer for ${id}.
`;

/** Writes a minimal fully-covered KB into a temp dir. */
async function writeValidKb(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'ic-kb-'));
	const files: Array<[string, string]> = [
		['frontend/fe-001.md', doc('fe-001', 'frontend', ['javascript', 'closures'])],
		['backend/be-001.md', doc('be-001', 'backend', ['api', 'rest'])],
		['behavioral/bh-001.md', doc('bh-001', 'behavioral', ['conflict', 'teamwork'])],
		['theory/th-001.md', doc('th-001', 'theory', ['databases', 'acid'])],
		['theory/th-002.md', doc('th-002', 'theory', ['nosql', 'base'])],
		['theory/th-003.md', doc('th-003', 'theory', ['ddd', 'aggregates'])],
		['theory/th-004.md', doc('th-004', 'theory', ['algorithms', 'big-o'])],
		['theory/th-005.md', doc('th-005', 'theory', ['networking', 'tcp'])]
	];
	for (const [path, content] of files) {
		await mkdir(join(dir, path, '..'), { recursive: true });
		await writeFile(join(dir, path), content, 'utf8');
	}
	return dir;
}

describe('validateKb', () => {
	it('passes a schema-valid, fully-covered KB meeting the min gate', async () => {
		const dir = await writeValidKb();
		const result = await validateKb(dir, { min: 8 });
		expect(result.errors).toEqual([]);
		expect(result.ok).toBe(true);
		expect(result.count).toBe(8);
		expect(result.perCategory).toMatchObject({ theory: 5, frontend: 1, backend: 1, behavioral: 1 });
	});

	it('fails below the min count gate and reports it', async () => {
		const dir = await writeValidKb();
		const result = await validateKb(dir, { min: 100 });
		expect(result.ok).toBe(false);
		expect(result.errors.join('\n')).toMatch(/8 documents; the gate requires >= 100/);
	});

	it('fails on schema-invalid files, duplicate ids and category/directory mismatch', async () => {
		const dir = await writeValidKb();
		await writeFile(join(dir, 'frontend/fe-dup.md'), doc('fe-001', 'frontend', ['a', 'b']), 'utf8');
		await writeFile(join(dir, 'frontend/fe-bad.md'), '---\nid: fe-bad\n---\n\nbody\n', 'utf8');
		await writeFile(
			join(dir, 'frontend/fe-misplaced.md'),
			doc('fe-misplaced', 'backend', ['a', 'b']),
			'utf8'
		);
		const result = await validateKb(dir, { min: 1 });
		expect(result.ok).toBe(false);
		const message = result.errors.join('\n');
		expect(message).toMatch(/duplicate id "fe-001"/);
		expect(message).toMatch(/fe-bad\.md.*"question"/);
		expect(message).toMatch(/category "backend" does not match its directory/);
	});

	it('fails when a category is missing or theory coverage is incomplete', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'ic-kb-'));
		await mkdir(join(dir, 'theory'), { recursive: true });
		await writeFile(join(dir, 'theory/th-001.md'), doc('th-001', 'theory', ['databases', 'acid']));
		const result = await validateKb(dir, { min: 1 });
		expect(result.ok).toBe(false);
		const message = result.errors.join('\n');
		expect(message).toMatch(/category "frontend" has no documents/);
		expect(message).toMatch(/theory category lacks DDD coverage/);
		expect(message).toMatch(/theory category lacks networking coverage/);
	});

	it('ignores README.md files and reports a missing directory', async () => {
		const dir = await writeValidKb();
		await writeFile(join(dir, 'README.md'), '# not a question\n', 'utf8');
		const result = await validateKb(dir, { min: 8 });
		expect(result.ok).toBe(true);
		const missing = await validateKb(join(dir, 'nope'), { min: 1 });
		expect(missing.ok).toBe(false);
		expect(missing.errors[0]).toMatch(/KB directory not found/);
	});

	it('accepts the real kb/ directory schema-wise (count via --min handled by CI gate)', async () => {
		const result = await validateKb('kb', { min: 8 });
		// Content agents own the >=100 gate; schema/coverage must already hold.
		expect(result.errors).toEqual([]);
		expect(result.ok).toBe(true);
	});
});
