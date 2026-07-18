/**
 * Smoke spec: the Tauri app launches and every screen from the PRD's
 * four-screen navigation (plan.md Phase 5 / Phase 6) is reachable.
 *
 * NOT run on the authoring machine (no Rust toolchain / tauri-driver / debug
 * binary — see docs/deferred-verification.md). `pnpm test:e2e` skips before
 * this file loads when preconditions are missing (e2e/preflight.ts).
 *
 * Selector contract: this spec assumes the UI layer exposes
 * `data-testid="nav-<route>"` links in the shell nav and a
 * `data-testid="screen-<route>"` root element per page, for
 * route in {live, kb, log, settings}. If the shipped UI uses different
 * testids, update the SCREENS table below to match — do not invent brittle
 * text/CSS selectors here.
 */
import { browser, $ } from '@wdio/globals';

type Screen = { route: string; navTestId: string; screenTestId: string };

const SCREENS: Screen[] = [
	{ route: '/', navTestId: 'nav-live', screenTestId: 'screen-live' },
	{ route: '/kb', navTestId: 'nav-kb', screenTestId: 'screen-kb' },
	{ route: '/log', navTestId: 'nav-log', screenTestId: 'screen-log' },
	{ route: '/settings', navTestId: 'nav-settings', screenTestId: 'screen-settings' }
];

describe('app launch + four-screen navigation', () => {
	before(async () => {
		// tauri-driver launches the app already pointed at frontendDist's
		// index.html (the Live Session route); this just makes the starting
		// state explicit and gives every test a known-good reset point.
		await browser.url('/');
	});

	it('launches with the Live Session screen visible', async () => {
		const liveScreen = await $('[data-testid="screen-live"]');
		await expect(liveScreen).toBeDisplayed();
	});

	for (const screen of SCREENS) {
		it(`navigates to ${screen.route}`, async () => {
			const navLink = await $(`[data-testid="${screen.navTestId}"]`);
			await navLink.click();

			const screenRoot = await $(`[data-testid="${screen.screenTestId}"]`);
			await expect(screenRoot).toBeDisplayed();
		});
	}

	it('does not surface an uncaught error banner on any screen', async () => {
		const errorBanner = await $('[data-testid="uncaught-error-banner"]');
		await expect(errorBanner).not.toExist();
	});
});
