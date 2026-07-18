import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @testing-library/svelte does not auto-register cleanup outside globals mode.
afterEach(() => cleanup());

// jsdom does not implement matchMedia; the theme toggle and reduced-motion
// checks in the design system read it, so component tests need a stub.
if (!window.matchMedia) {
	window.matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	}) as unknown as MediaQueryList;
}
