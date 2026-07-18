import type { TranscriptSegment, Unsubscribe } from './types.ts';

/**
 * Streaming speech-to-text. Both the local WhisperLive client and the OpenAI
 * Realtime client implement this; they emit the same TranscriptSegment events.
 */
export interface TranscriptionPort {
	start(): Promise<void>;
	stop(): Promise<void>;
	/** Push a chunk of raw audio (PCM/encoded per adapter contract). */
	sendAudio(chunk: Uint8Array): void;
	onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe;
}
