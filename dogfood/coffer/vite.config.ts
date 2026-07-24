import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Component tests (src/lib/ui/**) need jsdom so @sveltejs/vite-plugin-svelte
		// compiles those .svelte files for the CLIENT target; everything else stays
		// on the default `node` environment (server/core/adapters tests).
		// A per-file `// @vitest-environment jsdom` pragma is NOT enough here: it
		// only swaps vitest's global environment, not which Svelte build `import
		// { mount } from 'svelte'` resolves to — SvelteKit's own SSR-oriented
		// `resolve.conditions` otherwise wins over vite-plugin-svelte's per-
		// environment client defaults. `svelteTesting()` (from
		// @testing-library/svelte/vite, already a devDep for dec:13) fixes exactly
		// this by putting `browser` ahead of `node` in resolve.conditions —
		// active only under `process.env.VITEST`, so it's a no-op for dev/build.
		projects: [
			{
				extends: true,
				plugins: [svelteTesting()],
				test: {
					name: 'component',
					environment: 'jsdom',
					include: ['src/lib/ui/**/*.{test,spec}.{js,ts}']
				}
			},
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/lib/ui/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
