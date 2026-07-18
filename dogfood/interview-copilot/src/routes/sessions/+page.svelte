<script lang="ts">
	import { Badge, EmptyState, Panel, TranscriptBubble } from '$lib/ui/design-system';

	let { data } = $props();

	function formatStartedAt(startedAtMs: number): string {
		return new Date(startedAtMs).toLocaleString();
	}

	interface TimelineEntry {
		utteranceId: string;
		text: string;
		kind: 'question' | 'statement';
		startMs: number;
		retrieval?: { results: Array<{ id: string; score: number }> };
		answer?: { text: string; sourceIds: string[] };
	}

	const timeline = $derived<TimelineEntry[]>(
		(data.session?.utterances ?? []).map(({ utterance, kind }) => ({
			utteranceId: utterance.id,
			text: utterance.text,
			kind,
			startMs: utterance.startMs,
			retrieval: data.session?.retrievals.find((r) => r.utteranceId === utterance.id),
			answer: data.session?.answers.find((a) => a.utteranceId === utterance.id)?.draft
		}))
	);
</script>

<svelte:head>
	<title>Session Log · Interview Copilot</title>
</svelte:head>

<div class="sessions-layout" data-testid="screen-log">
	<Panel title="Sessions" subtitle="{data.sessions.length} logged">
		{#if data.sessions.length === 0}
			<EmptyState
				icon="🗂"
				title="No sessions logged yet"
				description="Sessions are logged when the app runs against a real transcription adapter. The Live Session screen's demo mode does not persist here."
			/>
		{:else}
			<ul class="session-list">
				{#each data.sessions as session (session.id)}
					<li>
						<a
							href="?id={session.id}"
							class="session-list-item"
							class:active={data.selectedId === session.id}
						>
							<span class="session-id">{session.id}</span>
							<span class="session-time">{formatStartedAt(session.startedAtMs)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	<Panel title="Timeline" subtitle={data.session ? data.session.id : undefined}>
		{#if !data.session}
			<EmptyState icon="⏱" title="Select a session" description="Pick a session on the left to see its timeline." />
		{:else if timeline.length === 0}
			<EmptyState icon="⏱" title="Empty session" description="No utterances were logged for this session." />
		{:else}
			<div class="timeline">
				{#each timeline as entry (entry.utteranceId)}
					<div class="timeline-entry">
						<TranscriptBubble
							speaker={entry.kind === 'question' ? 'interviewer' : 'interviewee'}
							text={entry.text}
							timestampMs={entry.startMs}
							highlighted={entry.kind === 'question'}
						/>
						{#if entry.retrieval}
							<div class="timeline-retrieval">
								<span class="timeline-label">Retrieved</span>
								{#each entry.retrieval.results as result (result.id)}
									<Badge tone="info">{result.id} · {Math.round(result.score * 100)}%</Badge>
								{/each}
							</div>
						{/if}
						{#if entry.answer}
							<div class="timeline-answer">
								<span class="timeline-label">Answer</span>
								<p>{entry.answer.text}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	.sessions-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
		gap: var(--space-4);
		flex: 1;
		min-height: 0;
	}

	.session-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.session-list-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		border: 1px solid transparent;
	}

	.session-list-item:hover {
		background: var(--color-bg-sunken);
	}

	.session-list-item.active {
		background: var(--color-brand-subtle);
		border-color: var(--color-brand);
	}

	.session-id {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.session-time {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-height: 36rem;
		overflow-y: auto;
	}

	.timeline-entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border);
	}

	.timeline-retrieval,
	.timeline-answer {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		flex-wrap: wrap;
		font-size: var(--text-sm);
	}

	.timeline-answer p {
		margin: 0;
	}

	.timeline-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--color-text-faint);
		text-transform: uppercase;
	}

	@media (max-width: 60rem) {
		.sessions-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
