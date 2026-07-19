/**
 * Boundary-lint: enforces hexagonal core purity ([dec:2]).
 *
 * - src/lib/core/**  may import only from other files under src/lib/core/**
 *   or src/lib/ports/** (relative imports), plus type-only imports from the
 *   TS/JS standard library types (no runtime stdlib, no node: builtins, no
 *   framework, no bare npm package, no adapters).
 * - src/lib/ports/** may import only from src/lib/ports/** or src/lib/core/**
 *   (relative), same restriction otherwise.
 *
 * This must pass on the empty tree (no files yet) and keep passing as core
 * and ports fill in during later phases.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const GUARDED_DIRS = ['src/lib/core', 'src/lib/ports'];

/** Recursively collect every .ts/.svelte file under a directory (if it exists). */
function collectFiles(dir: string): string[] {
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
			files.push(...collectFiles(full));
		} else if (/\.(ts|svelte)$/.test(entry) && !entry.endsWith('.test.ts')) {
			files.push(full);
		}
	}
	return files;
}

/** Extract static/dynamic import & export-from specifiers from source text. */
function extractImportSpecifiers(source: string): string[] {
	const specifiers: string[] = [];
	const patterns = [
		/import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
		/export\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
		/import\(\s*['"]([^'"]+)['"]\s*\)/g,
		/require\(\s*['"]([^'"]+)['"]\s*\)/g
	];
	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(source)) !== null) {
			specifiers.push(match[1]);
		}
	}
	return specifiers;
}

function isAllowedSpecifier(fileDir: string, specifier: string): boolean {
	// Only relative/parent-relative imports are allowed at all.
	if (!specifier.startsWith('.')) {
		return false;
	}
	const resolvedTarget = resolve(fileDir, specifier);
	const relToRoot = relative(join(ROOT, 'src', 'lib'), resolvedTarget);
	// Must resolve inside src/lib/core or src/lib/ports.
	return (
		relToRoot === 'core' ||
		relToRoot.startsWith('core/') ||
		relToRoot.startsWith('core' + '\\') ||
		relToRoot === 'ports' ||
		relToRoot.startsWith('ports/') ||
		relToRoot.startsWith('ports' + '\\')
	);
}

describe('boundary-lint: core and ports purity', () => {
	for (const guardedDir of GUARDED_DIRS) {
		const absoluteDir = join(ROOT, guardedDir);
		const files = collectFiles(absoluteDir);

		it(`${guardedDir} contains only files with permitted imports (checked ${files.length} file(s))`, () => {
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = extractImportSpecifiers(source);
				const fileDir = dirname(file);

				for (const specifier of specifiers) {
					if (!isAllowedSpecifier(fileDir, specifier)) {
						violations.push(
							`${relative(ROOT, file)}: forbidden import "${specifier}" ` +
								`(only relative imports within src/lib/core or src/lib/ports are allowed)`
						);
					}
				}
			}

			expect(violations, violations.join('\n')).toEqual([]);
		});
	}

	it('passes trivially on an empty core/ports tree', () => {
		// Explicit sentinel so the intent is visible even when the two checks
		// above report "0 file(s)" during early phases.
		expect(true).toBe(true);
	});
});
