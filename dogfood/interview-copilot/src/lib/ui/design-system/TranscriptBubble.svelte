<script lang="ts">
	/**
	 * Speaker-aware transcript bubble. There is no diarization port (accepted
	 * gap, PRD "Known accepted gaps") — `speaker` is the UI's heuristic label
	 * derived from question/statement classification: a detected question is
	 * attributed to the interviewer, a statement to the interviewee.
	 */
	type Speaker = 'interviewer' | 'interviewee';

	interface Props {
		speaker: Speaker;
		text: string;
		timestampMs?: number;
		highlighted?: boolean;
		interim?: boolean;
	}

	let { speaker, text, timestampMs, highlighted = false, interim = false }: Props = $props();

	function formatTimestamp(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<div class="bubble-row bubble-{speaker}">
	<div class="bubble" class:highlighted class:interim>
		<div class="bubble-meta">
			<span class="bubble-speaker">{speaker === 'interviewer' ? 'Interviewer' : 'You'}</span>
			{#if timestampMs !== undefined}
				<span class="bubble-time">{formatTimestamp(timestampMs)}</span>
			{/if}
		</div>
		<p class="bubble-text">{text}</p>
	</div>
</div>

<style>
	.bubble-row {
		display: flex;
		width: 100%;
	}

	.bubble-interviewer {
		justify-content: flex-start;
	}

	.bubble-interviewee {
		justify-content: flex-end;
	}

	.bubble {
		max-width: 34rem;
		border-radius: var(--radius-lg);
		padding: var(--space-2) var(--space-3);
		background: var(--color-speaker-interviewer-bg);
	}

	.bubble-interviewee .bubble {
		background: var(--color-speaker-interviewee-bg);
	}

	.bubble.interim {
		opacity: 0.6;
	}

	.bubble.highlighted {
		box-shadow: 0 0 0 2px var(--color-warning);
	}

	.bubble-meta {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin-bottom: 0.125rem;
	}

	.bubble-speaker {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--color-speaker-interviewer);
	}

	.bubble-interviewee .bubble-speaker {
		color: var(--color-speaker-interviewee);
	}

	.bubble-time {
		font-size: var(--text-xs);
		color: var(--color-text-faint);
		font-family: var(--font-mono);
	}

	.bubble-text {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-relaxed);
		color: var(--color-text);
		white-space: pre-wrap;
	}
</style>
