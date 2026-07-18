<script lang="ts">
	import type { RetrievedDoc } from '../../ports/types.ts';
	import Card from './Card.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		questionText?: string;
		answerText?: string;
		sources?: RetrievedDoc[];
		loading?: boolean;
	}

	let { questionText, answerText, sources = [], loading = false }: Props = $props();

	/** Best retrieved-doc score stands in for a confidence signal (no dedicated port). */
	const confidence = $derived(sources.length > 0 ? Math.max(...sources.map((s) => s.score)) : null);

	function confidenceTone(score: number): 'success' | 'warning' | 'danger' {
		if (score >= 0.7) return 'success';
		if (score >= 0.4) return 'warning';
		return 'danger';
	}

	function formatPercent(score: number): string {
		return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
	}
</script>

<Card elevated padding="md">
	<div class="answer-card">
		{#if questionText}
			<p class="answer-question">{questionText}</p>
		{/if}

		{#if loading}
			<div class="answer-loading">
				<Spinner size="sm" />
				<span>Drafting an answer…</span>
			</div>
		{:else if answerText}
			<div class="answer-body">
				<p class="answer-text">{answerText}</p>
				{#if confidence !== null}
					<span class="answer-confidence tone-{confidenceTone(confidence)}">
						confidence {formatPercent(confidence)}
					</span>
				{/if}
			</div>
			{#if sources.length > 0}
				<div class="answer-sources">
					<span class="answer-sources-label">Sources</span>
					<ul class="source-chip-list" data-testid="source-list">
						{#each sources as source (source.doc.id)}
							<li class="source-chip" data-testid="source-item" title={source.doc.question}>
								{source.doc.id}
								<span class="source-chip-score">{formatPercent(source.score)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else}
			<p class="answer-empty">No question detected yet.</p>
		{/if}
	</div>
</Card>

<style>
	.answer-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.answer-question {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
	}

	.answer-loading {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.answer-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.answer-text {
		margin: 0;
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
		white-space: pre-wrap;
	}

	.answer-confidence {
		align-self: flex-start;
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		padding: 0.125rem var(--space-2);
		border-radius: var(--radius-full);
	}

	.tone-success {
		background: var(--color-success-subtle);
		color: var(--color-success-600, var(--color-success));
	}

	.tone-warning {
		background: var(--color-warning-subtle);
		color: var(--color-warning-600, var(--color-warning));
	}

	.tone-danger {
		background: var(--color-danger-subtle);
		color: var(--color-danger-600, var(--color-danger));
	}

	.answer-sources {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.answer-sources-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--color-text-faint);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.source-chip-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
	}

	.source-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		background: var(--color-bg-sunken);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		padding: 0.125rem var(--space-2);
		color: var(--color-text-muted);
	}

	.source-chip-score {
		color: var(--color-text-faint);
	}

	.answer-empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}
</style>
