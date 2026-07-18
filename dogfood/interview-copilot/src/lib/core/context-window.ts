import type { Utterance } from '../ports/types.ts';

export interface ContextWindowOptions {
	/** Maximum age (seconds) relative to the newest utterance's end. Default 30. */
	maxSeconds: number;
	/** Maximum number of utterances. Default 6. */
	maxUtterances: number;
}

/**
 * Sliding transcript context window [dec:7]: the last `maxUtterances`
 * utterances no older than `maxSeconds` — whichever constraint is smaller
 * wins (both are applied).
 */
export class ContextWindow {
	private utterances: Utterance[] = [];

	constructor(private readonly options: ContextWindowOptions) {}

	add(utterance: Utterance): void {
		this.utterances.push(utterance);
		this.trim();
	}

	snapshot(): Utterance[] {
		return [...this.utterances];
	}

	clear(): void {
		this.utterances = [];
	}

	private trim(): void {
		const { maxSeconds, maxUtterances } = this.options;
		if (this.utterances.length > maxUtterances) {
			this.utterances = this.utterances.slice(-maxUtterances);
		}
		const newest = this.utterances.at(-1);
		if (!newest) return;
		const cutoffMs = newest.endMs - maxSeconds * 1000;
		this.utterances = this.utterances.filter((u) => u.endMs >= cutoffMs);
	}
}
