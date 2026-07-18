import { describe, expect, it } from 'vitest';
import type { Utterance } from '../ports/types.ts';
import { ContextWindow } from './context-window.ts';

let counter = 0;
const utt = (startMs: number, endMs: number, text = `utterance ${++counter}`): Utterance => ({
	id: `u${counter}`,
	text,
	startMs,
	endMs
});

describe('ContextWindow', () => {
	it('keeps at most maxUtterances', () => {
		const window = new ContextWindow({ maxSeconds: 1000, maxUtterances: 3 });
		const all = [utt(0, 1000), utt(2000, 3000), utt(4000, 5000), utt(6000, 7000)];
		for (const u of all) window.add(u);
		expect(window.snapshot().map((u) => u.id)).toEqual(all.slice(-3).map((u) => u.id));
	});

	it('drops utterances older than maxSeconds relative to the newest', () => {
		const window = new ContextWindow({ maxSeconds: 30, maxUtterances: 100 });
		const old = utt(0, 5000);
		const fresh = utt(40_000, 41_000);
		window.add(old);
		window.add(fresh);
		expect(window.snapshot().map((u) => u.id)).toEqual([fresh.id]);
	});

	it('applies whichever constraint is smaller (both together)', () => {
		const window = new ContextWindow({ maxSeconds: 30, maxUtterances: 2 });
		const a = utt(0, 1000);
		const b = utt(2000, 3000);
		const c = utt(4000, 5000);
		for (const u of [a, b, c]) window.add(u);
		// All within 30s, but count limit keeps only the last 2.
		expect(window.snapshot().map((u) => u.id)).toEqual([b.id, c.id]);
	});

	it('snapshot returns a copy and clear empties the window', () => {
		const window = new ContextWindow({ maxSeconds: 30, maxUtterances: 6 });
		window.add(utt(0, 1000));
		const snap = window.snapshot();
		snap.pop();
		expect(window.snapshot()).toHaveLength(1);
		window.clear();
		expect(window.snapshot()).toHaveLength(0);
	});
});
