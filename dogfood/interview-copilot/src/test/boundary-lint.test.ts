/**
 * Boundary lint [dec:2]: hexagonal purity enforced by grepping imports.
 * - src/lib/core/** may import only from src/lib/core/** and src/lib/ports/**
 * - src/lib/ports/** may import only from src/lib/ports/**
 * Neither may touch adapters, Tauri, network SDKs, node builtins, or any
 * package at all — core and ports are pure TypeScript.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', 'lib');

function tsFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
		.map((e) => join(e.parentPath, e.name));
}

function importSpecifiers(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const specifiers: string[] = [];
	const patterns = [
		/(?:^|\n)\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
		/(?:^|\n)\s*export\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
		/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
	];
	for (const pattern of patterns) {
		for (const match of source.matchAll(pattern)) specifiers.push(match[1]!);
	}
	return specifiers;
}

function violations(dir: string, allowedDirs: string[]): string[] {
	const found: string[] = [];
	for (const file of tsFiles(dir)) {
		for (const spec of importSpecifiers(file)) {
			const label = `${relative(ROOT, file)} imports "${spec}"`;
			if (!spec.startsWith('.')) {
				found.push(`${label} (package/builtin import forbidden)`);
				continue;
			}
			const target = resolve(file, '..', spec);
			if (!allowedDirs.some((allowed) => target.startsWith(allowed + '/') || target === allowed)) {
				found.push(`${label} (escapes ${allowedDirs.map((d) => relative(ROOT, d)).join(', ')})`);
			}
		}
	}
	return found;
}

describe('hexagonal boundary lint [dec:2]', () => {
	it('finds files to lint (sanity)', () => {
		expect(tsFiles(join(ROOT, 'core')).length).toBeGreaterThan(0);
		expect(tsFiles(join(ROOT, 'ports')).length).toBeGreaterThan(0);
	});

	it('src/lib/ports/** imports only from src/lib/ports/**', () => {
		expect(violations(join(ROOT, 'ports'), [join(ROOT, 'ports')])).toEqual([]);
	});

	it('src/lib/core/** imports only from core and ports', () => {
		expect(violations(join(ROOT, 'core'), [join(ROOT, 'core'), join(ROOT, 'ports')])).toEqual([]);
	});
});
