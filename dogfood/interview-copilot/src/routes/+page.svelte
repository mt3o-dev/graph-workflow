<script lang="ts">
	import { untrack } from 'svelte';
	import { AnswerCard, Badge, Button, EmptyState, Panel, Select, TranscriptBubble } from '$lib/ui/design-system';
	import { LiveSessionStore } from '$lib/ui/stores/live-session.svelte';
	import questionSession from '../test/fixtures/transcripts/question-session.json';
	import statementSession from '../test/fixtures/transcripts/statement-session.json';

	let { data } = $props();

	const fixtures = {
		'question-session': questionSession,
		'statement-session': statementSession
	} as const;

	let selectedFixture = $state<keyof typeof fixtures>('question-session');

	// Constructed once from the initial load; this route has no params so
	// `data` never changes for the lifetime of the component instance.
	const store = untrack(
		() => new LiveSessionStore({ adapterStatus: data.configured, contextWindow: data.contextWindow })
	);

	function handleStart(): void {
		void store.start(fixtures[selectedFixture]);
	}

	function handleStop(): void {
		store.stop();
	}

	function statusTone(status: string): 'neutral' | 'success' | 'warning' {
		if (status === 'running') return 'success';
		if (status === 'stopped') return 'warning';
		return 'neutral';
	}

	const contextPercent = $derived(
		Math.round(
			Math.max(
				store.contextWindowMeter.maxUtterances === 0
					? 0
					: (store.contextWindowMeter.utterances / store.contextWindowMeter.maxUtterances) * 100,
				store.contextWindowMeter.maxSeconds === 0
					? 0
					: (store.contextWindowMeter.seconds / store.contextWindowMeter.maxSeconds) * 100
			)
		)
	);
</script>

<svelte:head>
	<title>Live Session · Interview Copilot</title>
</svelte:head>

<div class="live-session" data-testid="screen-live">
	<Panel title="Session" subtitle="No microphone on this machine — demo mode replays a recorded transcript.">
		{#snippet actions()}
			<Select
				bind:value={selectedFixture}
				options={[
					{ value: 'question-session', label: 'Fixture: database question' },
					{ value: 'statement-session', label: 'Fixture: small talk only' }
				]}
			/>
			<Button data-testid="start-demo-session" onclick={handleStart} disabled={store.status === 'running'}>
				Start session
			</Button>
			<Button variant="secondary" onclick={handleStop} disabled={store.status !== 'running'}>
				Stop session
			</Button>
		{/snippet}

		<div class="session-meta">
			<span class="meta-row">
				<span class="meta-label">Status</span>
				<Badge tone={statusTone(store.status)}>{store.status}</Badge>
			</span>
			<span class="meta-row">
				<span class="meta-label">STT</span>
				<Badge tone="neutral">{store.adapterStatus.sttAdapter}</Badge>
			</span>
			<span class="meta-row">
				<span class="meta-label">Embeddings</span>
				<Badge tone="neutral">{store.adapterStatus.embeddingsAdapter}</Badge>
			</span>
			<span class="meta-row">
				<span class="meta-label">Answer LLM</span>
				<Badge tone="neutral">{store.adapterStatus.answerAdapter}</Badge>
			</span>
			<span class="meta-row context-meter">
				<span class="meta-label">Context window</span>
				<span
					class="meter-track"
					role="meter"
					aria-valuenow={contextPercent}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<span class="meter-fill" style="width: {contextPercent}%"></span>
				</span>
				<span class="meter-label">
					{store.contextWindowMeter.utterances}/{store.contextWindowMeter.maxUtterances} utterances ·
					{store.contextWindowMeter.seconds.toFixed(1)}s/{store.contextWindowMeter.maxSeconds}s
				</span>
			</span>
		</div>

		{#if store.error}
			<p class="session-error">{store.error}</p>
		{/if}
	</Panel>

	<div class="live-session-grid">
		<Panel title="Transcript" subtitle="Interviewer questions are highlighted the moment they're detected.">
			<div class="transcript-scroll" data-testid="transcript">
				{#if store.transcript.length === 0 && !store.interimText}
					<EmptyState
						icon="🎙"
						title="No transcript yet"
						description="Start a demo session to replay a recorded interview slice."
					/>
				{:else}
					{#each store.transcript as entry (entry.id)}
						<TranscriptBubble
							speaker={entry.speaker}
							text={entry.text}
							timestampMs={entry.timestampMs}
							highlighted={entry.highlighted}
						/>
					{/each}
					{#if store.interimText}
						<TranscriptBubble speaker="interviewer" text={store.interimText} interim />
					{/if}
				{/if}
			</div>
		</Panel>

		<Panel title="Answer draft" subtitle="Auto-updates when a question is detected.">
			<div data-testid="answer-card">
				<AnswerCard
					questionText={store.currentQuestion?.text}
					answerText={store.currentAnswer?.text}
					sources={store.currentAnswer?.sources}
					loading={store.currentAnswer?.loading ?? false}
				/>
			</div>
		</Panel>
	</div>
</div>

<style>
	.live-session {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		flex: 1;
		min-height: 0;
	}

	.session-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
	}

	.meta-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.meta-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--color-text-faint);
	}

	.context-meter {
		flex: 1;
		min-width: 14rem;
	}

	.meter-track {
		display: inline-block;
		width: 6rem;
		height: 0.375rem;
		border-radius: var(--radius-full);
		background: var(--color-bg-sunken);
		overflow: hidden;
	}

	.meter-fill {
		display: block;
		height: 100%;
		background: var(--color-brand);
		transition: width var(--duration-base) var(--ease-standard);
	}

	.meter-label {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.session-error {
		margin: 0;
		color: var(--color-danger);
		font-size: var(--text-sm);
	}

	.live-session-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-4);
		flex: 1;
		min-height: 0;
	}

	.transcript-scroll {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-height: 32rem;
		overflow-y: auto;
	}

	@media (max-width: 60rem) {
		.live-session-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
