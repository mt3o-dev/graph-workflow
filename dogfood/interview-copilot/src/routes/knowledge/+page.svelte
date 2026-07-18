<script lang="ts">
	import { untrack } from 'svelte';
	import { Badge, EmptyState, Input, MetaTag, Panel, Select } from '$lib/ui/design-system';
	import { renderMarkdown } from '$lib/ui/markdown';
	import { KB_CATEGORIES, KB_DIFFICULTIES, KB_EXPERTISE } from '../../lib/ports/types.ts';

	let { data } = $props();

	let search = $state('');
	let category = $state('all');
	let difficulty = $state('all');
	let expertise = $state('all');
	let selectedId = $state<string | null>(untrack(() => data.docs[0]?.id ?? null));

	const categoryOptions = [{ value: 'all', label: 'All categories' }, ...KB_CATEGORIES.map((c) => ({ value: c, label: c }))];
	const difficultyOptions = [{ value: 'all', label: 'All difficulties' }, ...KB_DIFFICULTIES.map((d) => ({ value: d, label: d }))];
	const expertiseOptions = [{ value: 'all', label: 'All levels' }, ...KB_EXPERTISE.map((e) => ({ value: e, label: e }))];

	const filtered = $derived(
		data.docs.filter((doc) => {
			if (category !== 'all' && doc.category !== category) return false;
			if (difficulty !== 'all' && doc.difficulty !== difficulty) return false;
			if (expertise !== 'all' && doc.expertise !== expertise) return false;
			if (search.trim() === '') return true;
			const needle = search.trim().toLowerCase();
			return (
				doc.question.toLowerCase().includes(needle) ||
				doc.tags.some((tag) => tag.toLowerCase().includes(needle))
			);
		})
	);

	const selected = $derived(data.docs.find((doc) => doc.id === selectedId) ?? filtered[0] ?? null);
	const renderedAnswer = $derived(selected ? renderMarkdown(selected.answer) : '');
</script>

<svelte:head>
	<title>Knowledge Base · Interview Copilot</title>
</svelte:head>

<div class="kb-layout" data-testid="screen-kb">
	<Panel title="Knowledge base" subtitle="{filtered.length} of {data.docs.length} questions">
		<div class="kb-filters">
			<Input label="Search" placeholder="Question or tag…" bind:value={search} />
			<Select label="Category" bind:value={category} options={categoryOptions} />
			<Select label="Difficulty" bind:value={difficulty} options={difficultyOptions} />
			<Select label="Expertise" bind:value={expertise} options={expertiseOptions} />
		</div>

		{#if filtered.length === 0}
			<EmptyState icon="🔍" title="No matches" description="Try clearing a filter or the search text." />
		{:else}
			<ul class="kb-list">
				{#each filtered as doc (doc.id)}
					<li>
						<button
							type="button"
							class="kb-list-item"
							class:active={selected?.id === doc.id}
							onclick={() => (selectedId = doc.id)}
						>
							<span class="kb-question">{doc.question}</span>
							<span class="kb-tags">
								<MetaTag kind="category" value={doc.category} />
								<MetaTag kind="difficulty" value={doc.difficulty} />
								<MetaTag kind="expertise" value={doc.expertise} />
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	<Panel title="Answer">
		{#if selected}
			<div class="kb-detail">
				<h2 class="kb-detail-question">{selected.question}</h2>
				<div class="kb-detail-meta">
					<MetaTag kind="category" value={selected.category} />
					<MetaTag kind="difficulty" value={selected.difficulty} />
					<MetaTag kind="expertise" value={selected.expertise} />
					{#each selected.tags as tag (tag)}
						<Badge tone="neutral">{tag}</Badge>
					{/each}
				</div>
				<div class="kb-answer">
					<!-- eslint-disable svelte/no-at-html-tags -- trusted local markdown, kb/**/*.md only -->
					{@html renderedAnswer}
				</div>
			</div>
		{:else}
			<EmptyState icon="📘" title="No question selected" />
		{/if}
	</Panel>
</div>

<style>
	.kb-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: var(--space-4);
		flex: 1;
		min-height: 0;
	}

	.kb-filters {
		display: grid;
		grid-template-columns: repeat(4, minmax(8rem, 1fr));
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.kb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		max-height: 34rem;
		overflow-y: auto;
	}

	.kb-list-item {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		text-align: left;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		font: inherit;
		color: var(--color-text);
	}

	.kb-list-item:hover {
		background: var(--color-bg-sunken);
	}

	.kb-list-item.active {
		background: var(--color-brand-subtle);
		border-color: var(--color-brand);
	}

	.kb-question {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.kb-tags {
		display: flex;
		gap: var(--space-1);
		flex-wrap: wrap;
	}

	.kb-detail-question {
		margin: 0 0 var(--space-2);
		font-size: var(--text-lg);
	}

	.kb-detail-meta {
		display: flex;
		gap: var(--space-1);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);
	}

	.kb-answer {
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
	}

	.kb-answer :global(p) {
		margin: 0 0 var(--space-3);
	}

	.kb-answer :global(code) {
		font-family: var(--font-mono);
		background: var(--color-bg-sunken);
		padding: 0.0625rem 0.25rem;
		border-radius: var(--radius-sm);
		font-size: 0.9em;
	}

	.kb-answer :global(pre) {
		background: var(--color-bg-sunken);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		overflow-x: auto;
	}

	.kb-answer :global(ul) {
		margin: 0 0 var(--space-3);
		padding-left: var(--space-5);
	}

	@media (max-width: 60rem) {
		.kb-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
