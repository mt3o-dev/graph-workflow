/**
 * Live Session "demo mode" spec: with no live mic/STT/network available
 * (this is a hard constraint of the whole project — see
 * docs/deferred-verification.md and plan.md's non-goals), the Live Session
 * screen must still be exercisable end-to-end by feeding it a recorded
 * transcript fixture (src/test/fixtures/transcripts/) through the fake
 * ports (src/test/fakes/), same as the Phase 2/5 unit and component tests.
 *
 * This spec assumes the shipped UI exposes a "demo mode" trigger — e.g. a
 * settings/dev toggle that swaps the DI container's real adapters for the
 * fakes and replays a fixture — so an e2e run never depends on a live
 * Whisper/OpenAI/Anthropic connection. If no such trigger exists yet, treat
 * this spec's testids as the contract the UI needs to satisfy, not as
 * already-implemented fact.
 *
 * NOT run on the authoring machine — see e2e/preflight.ts /
 * e2e/README-e2e.md.
 */
import { browser, $, $$ } from '@wdio/globals';

describe('live session — demo mode shows an answer card', () => {
	before(async () => {
		await browser.url('/');
	});

	it('starts a demo session from a recorded-transcript fixture', async () => {
		const demoButton = await $('[data-testid="start-demo-session"]');
		await demoButton.waitForClickable({ timeout: 10000 });
		await demoButton.click();
	});

	it('renders the running transcript from the fixture', async () => {
		const transcript = await $('[data-testid="transcript"]');
		await transcript.waitForDisplayed({ timeout: 10000 });
		const text = await transcript.getText();
		expect(text.length).toBeGreaterThan(0);
	});

	it('detects the fixture question and shows an answer card with sources', async () => {
		const answerCard = await $('[data-testid="answer-card"]');
		// Retrieval + answering runs against fakes (Phase 2/3), so this should
		// resolve quickly, but give it headroom for the orchestrator's
		// internal promise queue (session-orchestrator.ts) to drain.
		await answerCard.waitForDisplayed({ timeout: 15000 });

		const sourceList = await $('[data-testid="source-list"]');
		await expect(sourceList).toBeDisplayed();

		const sourceItems = await $$('[data-testid="source-list"] [data-testid="source-item"]');
		expect(sourceItems.length).toBeGreaterThan(0);
	});
});
