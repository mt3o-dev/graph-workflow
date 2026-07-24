/**
 * no-hardcoded-strings guard (constraint [node:4a03791d], plan P2).
 *
 * Scans `src/routes/**\/*.svelte` and `src/lib/ui/**\/*.svelte` for
 * user-visible string literals in markup that bypass the typed catalog
 * (`{t(locale, key)}`, [node:a0330a47]) — both text nodes and the
 * user-facing attributes (`title`, `aria-label`, `placeholder`, `alt`).
 *
 * Modelled on `boundary-lint.test.ts`'s file-walk shape: a pure scan
 * function over source text, exercised two ways —
 *   1. against a hand-fixtured markup string containing a seeded violation,
 *      proving the scanner actually flags something (a guard that always
 *      passes is worse than no guard); and
 *   2. against the real tree, which must stay green.
 *
 * Pragmatic exclusions (plan P2):
 *  - `<script>` / `<style>` block contents (not markup).
 *  - Structural/non-visible attributes: `class`, `style`, `href`, `id`,
 *    `role`, `type`, `name`, any `data-*` (incl. `data-testid`), any
 *    `aria-*` OTHER than `aria-label` (e.g. `aria-hidden`, `aria-describedby`
 *    reference an id, not display text).
 *  - Non-alphabetic text (punctuation, whitespace, numbers, symbols like
 *    "—" used as bare separators).
 *  - The explicit brand allowlist (`Coffer` — [node:a0330a47] keeps the
 *    brand name untranslated across locales).
 *  - Svelte template expressions (`{...}`), which may legitimately contain
 *    `t(...)` calls or other bound data (group names are USER data, never
 *    flagged — [node:aeb2d1f6]).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const GUARDED_DIRS = ['src/routes', 'src/lib/ui'];

const FLAGGED_ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
const BRAND_ALLOWLIST = new Set(['Coffer']);

/** Recursively collect every `.svelte` file under a directory (if it exists). */
function collectSvelteFiles(dir: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			files.push(...collectSvelteFiles(full));
		} else if (entry.endsWith('.svelte')) {
			files.push(full);
		}
	}
	return files;
}

/** Strip `<script>`/`<style>` block contents and HTML comments — not
 * markup, not scanned (a `<!-- ... -->` note is developer prose, not UI). */
function stripNonMarkup(source: string): string {
	return source
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Replace every balanced `{...}` Svelte expression (which may nest, e.g.
 * `{t(locale, 'x', { name: userName })}`, or be a block tag like
 * `{#each items as item}`) with whitespace, preserving newlines so
 * subsequent line-based scanning stays meaningful. A naive
 * `/\{[^{}]*\}/`-style regex cannot handle the nested-object-literal case
 * and would leave inner text exposed as a false "text node".
 */
function stripBalancedExpressions(markup: string): string {
	let depth = 0;
	let out = '';
	for (const ch of markup) {
		if (ch === '{') {
			depth++;
			continue;
		}
		if (ch === '}') {
			if (depth > 0) depth--;
			continue;
		}
		if (depth > 0) {
			out += ch === '\n' ? '\n' : ' ';
		} else {
			out += ch;
		}
	}
	return out;
}

/** True if `raw` (already trimmed) contains a letter that isn't part of an
 * excluded case (pure punctuation/digits, or the brand allowlist). */
function isHardcodedText(raw: string): boolean {
	const trimmed = raw.trim();
	if (trimmed === '') return false;
	if (BRAND_ALLOWLIST.has(trimmed)) return false;
	// Requires at least one Latin (incl. Polish diacritics) letter to count
	// as user-visible prose — pure punctuation/digits/symbols pass through.
	return /[A-Za-zÀ-ſ]/.test(trimmed);
}

/**
 * Scan one `.svelte` source string for hardcoded-string violations. Returns
 * human-readable violation descriptions (empty array = clean).
 */
export function findHardcodedStringViolations(source: string, label: string): string[] {
	const violations: string[] = [];
	const markup = stripNonMarkup(source);

	// 1. User-facing attribute literals: title="...", aria-label='...', etc.
	//    A `{...}`-bound attribute (e.g. title={t('x.y')}) is a Svelte
	//    expression, not a quoted literal, so it never matches this pattern.
	const attrGroup = FLAGGED_ATTRS.join('|');
	const doubleQuoted = new RegExp(`\\b(?:${attrGroup})\\s*=\\s*"([^"]*)"`, 'gi');
	const singleQuoted = new RegExp(`\\b(?:${attrGroup})\\s*=\\s*'([^']*)'`, 'gi');
	for (const pattern of [doubleQuoted, singleQuoted]) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(markup)) !== null) {
			const value = match[1];
			if (isHardcodedText(value)) {
				violations.push(`${label}: hardcoded attribute literal "${value}" in \`${match[0]}\``);
			}
		}
	}

	// 2. Text nodes: strip Svelte `{...}` expressions FIRST (balanced, may
	//    nest — an event handler like `onkeydown={(e) => select(tab.id)}`
	//    contains a bare `>` that would otherwise break naive tag-stripping),
	//    then strip tags; whatever prose remains outside a tag is a
	//    hardcoded text node.
	const withoutExpressions = stripBalancedExpressions(markup);
	const withoutTags = withoutExpressions.replace(/<[^>]*>/g, '\n');
	for (const rawLine of withoutTags.split('\n')) {
		const trimmed = rawLine.trim();
		if (isHardcodedText(trimmed)) {
			violations.push(`${label}: hardcoded text node "${trimmed}"`);
		}
	}

	return violations;
}

describe('no-hardcoded-strings guard: proves it can fail', () => {
	it('flags a seeded violation in fixture markup (text node)', () => {
		const fixture = `
			<div class="card">
				<h1>Welcome to the Treasury</h1>
				<p>{t(locale, 'dashboard.subtitle')}</p>
			</div>
		`;
		const violations = findHardcodedStringViolations(fixture, 'fixture.svelte');
		expect(violations.length).toBeGreaterThan(0);
		expect(violations.some((v) => v.includes('Welcome to the Treasury'))).toBe(true);
	});

	it('flags a seeded violation in fixture markup (aria-label attribute)', () => {
		const fixture = `<button aria-label="Close this dialog">×</button>`;
		const violations = findHardcodedStringViolations(fixture, 'fixture.svelte');
		expect(violations.length).toBeGreaterThan(0);
		expect(violations.some((v) => v.includes('Close this dialog'))).toBe(true);
	});

	it('does NOT flag catalog calls, bound expressions, brand, or structural attrs', () => {
		const fixture = `
			<div class="ornament" data-testid="dashboard-header" aria-hidden="true" id="hdr">
				<h1>{t(locale, 'dashboard.title')}</h1>
				<p>{t(locale, 'dashboard.welcomeBack', { name: userName })}</p>
				<span>{groupName}</span>
				<span>Coffer</span>
				<hr aria-hidden="true" />
				<span>—</span>
			</div>
		`;
		expect(findHardcodedStringViolations(fixture, 'fixture.svelte')).toEqual([]);
	});
});

describe('no-hardcoded-strings guard: real tree', () => {
	for (const guardedDir of GUARDED_DIRS) {
		const absoluteDir = join(ROOT, guardedDir);
		const files = collectSvelteFiles(absoluteDir);

		it(`${guardedDir} has no hardcoded UI strings (checked ${files.length} file(s))`, () => {
			const violations = files.flatMap((file) =>
				findHardcodedStringViolations(readFileSync(file, 'utf-8'), relative(ROOT, file))
			);
			expect(violations, violations.join('\n')).toEqual([]);
		});
	}

	it('passes trivially when routes/ui-svelte barely exist yet', () => {
		// Explicit sentinel, mirroring boundary-lint.test.ts's intent: this
		// guard is meant to stay green now and bite in P4 once real screens
		// with real markup land.
		expect(true).toBe(true);
	});
});
