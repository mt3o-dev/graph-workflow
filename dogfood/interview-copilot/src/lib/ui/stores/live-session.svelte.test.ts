import { waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import questionSession from '../../../test/fixtures/transcripts/question-session.json';
import statementSession from '../../../test/fixtures/transcripts/statement-session.json';
import { LiveSessionStore } from './live-session.svelte.ts';

describe('LiveSessionStore', () => {
	it('plays a recorded fixture and produces a grounded answer for the detected question', async () => {
		const store = new LiveSessionStore({ playbackSpeed: 500 });
		await store.start(questionSession);

		await waitFor(() => {
			expect(store.currentAnswer?.loading).toBe(false);
		});

		// The store auto-stops (flushing the trailing utterance) shortly after
		// the last fixture segment, so playback finishes in the 'stopped' state.
		expect(store.status).toBe('stopped');
		expect(store.currentQuestion?.text).toContain('ACID');
		expect(store.currentQuestion?.speaker).toBe('interviewer');
		expect(store.currentAnswer?.text).toContain('ACID');
		expect(store.currentAnswer?.sources.length).toBeGreaterThan(0);
		expect(store.currentAnswer?.sources[0]?.doc.id).toBe('th-acid');

		// The small-talk statements extend the context window but are attributed
		// to the interviewee heuristic (no diarization port — accepted gap).
		const smallTalk = store.transcript.find((entry) => entry.text.includes('excited'));
		expect(smallTalk?.speaker).toBe('interviewee');
		expect(smallTalk?.highlighted).toBe(false);

		expect(store.contextWindowMeter.utterances).toBeGreaterThan(0);
	});

	it('extends the context window but never fires retrieval for statement-only fixtures', async () => {
		const store = new LiveSessionStore({ playbackSpeed: 500 });
		await store.start(statementSession);

		await waitFor(() => {
			expect(store.transcript.length).toBeGreaterThan(0);
		});
		// Give any (absent) retrieval/answer pipeline a chance to fire before asserting it didn't.
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(store.currentQuestion).toBeNull();
		expect(store.currentAnswer).toBeNull();
		store.stop();
	});

	it('reset clears transcript, answer and context-window state', async () => {
		const store = new LiveSessionStore({ playbackSpeed: 500 });
		await store.start(questionSession);
		await waitFor(() => {
			expect(store.currentAnswer?.loading).toBe(false);
		});

		store.reset();

		expect(store.transcript).toEqual([]);
		expect(store.currentAnswer).toBeNull();
		expect(store.currentQuestion).toBeNull();
		expect(store.contextWindowMeter.utterances).toBe(0);
		expect(store.status).toBe('idle');
	});
});
