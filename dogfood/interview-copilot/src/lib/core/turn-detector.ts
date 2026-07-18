import type { TranscriptSegment, Utterance } from '../ports/types.ts';

export interface TurnDetectorOptions {
	/** Silence gap (ms) between final segments that closes an utterance. Default 700. */
	silenceMs: number;
}

/**
 * VAD-gap utterance segmentation [dec:8].
 * Consecutive final transcript segments accumulate into one utterance; a gap
 * of `silenceMs` or more between a segment's start and the previous segment's
 * end closes the utterance. Interim segments never close a turn.
 */
export class TurnDetector {
	private pending: TranscriptSegment[] = [];
	private counter = 0;

	constructor(private readonly options: TurnDetectorOptions) {}

	/** Feed one segment; returns a closed utterance when the gap rule fires. */
	push(segment: TranscriptSegment): Utterance | null {
		if (!segment.final) return null;
		const last = this.pending.at(-1);
		if (last && segment.startMs - last.endMs >= this.options.silenceMs) {
			const closed = this.build();
			this.pending = [segment];
			return closed;
		}
		this.pending.push(segment);
		return null;
	}

	/** Close and return whatever is accumulated (e.g. at session stop). */
	flush(): Utterance | null {
		if (this.pending.length === 0) return null;
		const closed = this.build();
		this.pending = [];
		return closed;
	}

	private build(): Utterance {
		const first = this.pending[0]!;
		const last = this.pending.at(-1)!;
		this.counter += 1;
		return {
			id: `u${this.counter}`,
			text: this.pending.map((s) => s.text.trim()).join(' '),
			startMs: first.startMs,
			endMs: last.endMs
		};
	}
}
