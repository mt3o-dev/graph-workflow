/**
 * Knowledge-base acceptance gate [dec:10, PRD FR6].
 *
 * Asserts every kb markdown file parses and is schema-valid, ids are unique,
 * the total count meets the gate (>=100 by default, --min N to override while
 * content is still landing), all four categories are present, and the theory
 * category covers ACID/BASE, DDD, complexity and networking (by tags).
 *
 * Usage: pnpm validate:kb [--min N] [--dir path]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseKbDoc } from '../src/lib/adapters/markdown-kb.adapter.ts';
import { KB_CATEGORIES, type KbDoc } from '../src/lib/ports/types.ts';

export interface KbValidationResult {
	ok: boolean;
	errors: string[];
	count: number;
	perCategory: Record<string, number>;
}

/** Theory coverage: each topic must appear in at least one theory doc's tags. */
const THEORY_COVERAGE: Record<string, string[]> = {
	'ACID': ['acid'],
	'BASE': ['base', 'eventual-consistency'],
	'DDD': ['ddd', 'domain-driven-design'],
	'complexity': ['big-o', 'complexity', 'complexity-analysis'],
	'networking': ['networking', 'tcp', 'dns']
};

export async function validateKb(dir: string, options: { min: number }): Promise<KbValidationResult> {
	const errors: string[] = [];
	const docs: KbDoc[] = [];
	const seenIds = new Map<string, string>();

	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true, recursive: true });
	} catch {
		return { ok: false, errors: [`KB directory not found: ${dir}`], count: 0, perCategory: {} };
	}
	const files = entries
		.filter((e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md')
		.map((e) => join(e.parentPath, e.name))
		.sort();

	for (const file of files) {
		const { doc, errors: fileErrors } = parseKbDoc(await readFile(file, 'utf8'), file);
		if (!doc) {
			errors.push(...fileErrors);
			continue;
		}
		const previous = seenIds.get(doc.id);
		if (previous) {
			errors.push(`${file}: duplicate id "${doc.id}" (also in ${previous})`);
			continue;
		}
		seenIds.set(doc.id, file);
		if (!file.includes(`/${doc.category}/`)) {
			errors.push(`${file}: category "${doc.category}" does not match its directory`);
		}
		docs.push(doc);
	}

	const perCategory: Record<string, number> = {};
	for (const category of KB_CATEGORIES) perCategory[category] = 0;
	for (const doc of docs) perCategory[doc.category] = (perCategory[doc.category] ?? 0) + 1;

	for (const category of KB_CATEGORIES) {
		if (perCategory[category] === 0) errors.push(`category "${category}" has no documents`);
	}

	if (docs.length < options.min) {
		errors.push(`KB holds ${docs.length} documents; the gate requires >= ${options.min}`);
	}

	const theoryTags = new Set(
		docs.filter((d) => d.category === 'theory').flatMap((d) => d.tags.map((t) => t.toLowerCase()))
	);
	for (const [topic, acceptedTags] of Object.entries(THEORY_COVERAGE)) {
		if (!acceptedTags.some((tag) => theoryTags.has(tag))) {
			errors.push(
				`theory category lacks ${topic} coverage (no doc tagged ${acceptedTags.join('/')})`
			);
		}
	}

	return { ok: errors.length === 0, errors, count: docs.length, perCategory };
}

function parseArgs(argv: string[]): { min: number; dir: string } {
	let min = 100;
	let dir = 'kb';
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--min') min = Number(argv[++i]);
		else if (argv[i] === '--dir') dir = argv[++i]!;
	}
	if (!Number.isFinite(min) || min < 0) throw new Error('--min expects a non-negative number');
	return { min, dir };
}

const isMain = process.argv[1]?.endsWith('validate-kb.ts') ?? false;
if (isMain) {
	const { min, dir } = parseArgs(process.argv.slice(2));
	const result = await validateKb(dir, { min });
	const summary = Object.entries(result.perCategory)
		.map(([category, count]) => `${category}=${count}`)
		.join(' ');
	if (result.ok) {
		console.log(`validate-kb OK: ${result.count} docs (${summary}), min gate ${min}`);
	} else {
		console.error(`validate-kb FAILED: ${result.count} docs (${summary}), min gate ${min}`);
		for (const error of result.errors) console.error(`  - ${error}`);
		process.exit(1);
	}
}
