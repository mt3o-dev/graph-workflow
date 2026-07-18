<script lang="ts">
	import Badge from '../design-system/Badge.svelte';

	interface Props {
		sttAdapter: string;
		embeddingsAdapter: string;
		answerAdapter: string;
	}

	let { sttAdapter, embeddingsAdapter, answerAdapter }: Props = $props();
</script>

<footer class="status-footer">
	<span class="status-item">
		<span class="status-key">STT</span>
		<Badge tone="neutral">{sttAdapter}</Badge>
	</span>
	<span class="status-item">
		<span class="status-key">Embeddings</span>
		<Badge tone="neutral">{embeddingsAdapter}</Badge>
	</span>
	<span class="status-item">
		<span class="status-key">Answer LLM</span>
		<Badge tone="neutral">{answerAdapter}</Badge>
	</span>
	<span class="status-note">Interview Copilot · local-first, adapters configurable in Settings</span>
</footer>

<style>
	.status-footer {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--color-border);
		background: var(--color-bg-sunken);
		font-size: var(--text-xs);
		color: var(--color-text-faint);
	}

	.status-item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.status-key {
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
	}

	.status-note {
		margin-left: auto;
	}
</style>
