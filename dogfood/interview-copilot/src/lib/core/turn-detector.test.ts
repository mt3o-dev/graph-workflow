import { describe, expect, it } from 'vitest';
import { TurnDetector } from './turn-detector.ts';

const seg = (text: string, startMs: number, endMs: number, final = true) => ({
	text,
	startMs,
	endMs,
	final
});

describe('TurnDetector', () => {
	it('merges consecutive final segments separated by less than silenceMs', () => {
		const detector = new TurnDetector({ silenceMs: 700 });
		expect(detector.push(seg('Hello there,', 0, 1000))).toBeNull();
		expect(detector.push(seg('nice to meet you.', 1100, 2000))).toBeNull();
		const closed = detector.flush();
		expect(closed).toMatchObject({
			text: 'Hello there, nice to meet you.',
			startMs: 0,
			endMs: 2000
		});
	});

	it('closes the utterance when the gap reaches silenceMs', () => {
		const detector = new TurnDetector({ silenceMs: 700 });
		detector.push(seg('First turn.', 0, 1000));
		const closed = detector.push(seg('Second turn.', 1700, 2500));
		expect(closed).toMatchObject({ text: 'First turn.', startMs: 0, endMs: 1000 });
		expect(detector.flush()).toMatchObject({ text: 'Second turn.' });
	});

	it('does not close on a gap just under silenceMs', () => {
		const detector = new TurnDetector({ silenceMs: 700 });
		detector.push(seg('a', 0, 1000));
		expect(detector.push(seg('b', 1699, 2000))).toBeNull();
	});

	it('ignores interim segments entirely', () => {
		const detector = new TurnDetector({ silenceMs: 700 });
		detector.push(seg('Stable text.', 0, 1000));
		expect(detector.push(seg('interim rev', 5000, 6000, false))).toBeNull();
		// Interim did not close the turn nor join it.
		expect(detector.flush()).toMatchObject({ text: 'Stable text.', endMs: 1000 });
	});

	it('flush on empty state returns null and utterance ids are unique', () => {
		const detector = new TurnDetector({ silenceMs: 700 });
		expect(detector.flush()).toBeNull();
		detector.push(seg('one', 0, 100));
		const a = detector.flush();
		detector.push(seg('two', 0, 100));
		const b = detector.flush();
		expect(a!.id).not.toBe(b!.id);
	});
});
