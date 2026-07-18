<script lang="ts">
	import { Badge, Input, Panel, Tabs } from '$lib/ui/design-system';
	import type { ConfigFieldProvenance } from '$lib/server/config-provenance.server';

	let { data } = $props();

	const groups: Record<string, { label: string; paths: string[] }> = {
		adapters: {
			label: 'Adapters',
			paths: [
				'stt.adapter',
				'stt.whisper.url',
				'stt.whisper.language',
				'stt.whisper.model',
				'stt.openai.url',
				'stt.openai.model',
				'embeddings.adapter',
				'embeddings.openai.model',
				'embeddings.openai.baseUrl',
				'answer.adapter',
				'answer.anthropic.model',
				'answer.anthropic.baseUrl',
				'answer.anthropic.maxTokens'
			]
		},
		timing: {
			label: 'Context window + VAD',
			paths: ['contextWindow.maxSeconds', 'contextWindow.maxUtterances', 'vad.silenceMs', 'retrieval.topK']
		},
		storage: {
			label: 'Storage',
			paths: ['index.adapter', 'sessionLog.adapter', 'kb.adapter', 'kb.dir', 'db.file']
		}
	};

	let active = $state('adapters');

	const fieldsByPath = $derived(new Map(data.fields.map((f) => [f.path, f])));

	function fieldsFor(paths: string[]): ConfigFieldProvenance[] {
		return paths.map((path) => fieldsByPath.get(path)).filter((f): f is ConfigFieldProvenance => !!f);
	}

	function layerBadgeTone(setBy: ConfigFieldProvenance['setBy']): 'neutral' | 'info' | 'brand' | 'warning' {
		switch (setBy) {
			case 'env-var':
				return 'warning';
			case 'user-file':
				return 'brand';
			case 'env-file':
				return 'info';
			default:
				return 'neutral';
		}
	}

	function layerLabel(setBy: ConfigFieldProvenance['setBy']): string {
		switch (setBy) {
			case 'default':
				return 'default.json';
			case 'env-file':
				return 'env config';
			case 'user-file':
				return 'local.json';
			case 'env-var':
				return 'env var';
			default:
				return 'unset';
		}
	}

	function displayValue(value: unknown): string {
		if (value === undefined || value === null) return '—';
		return typeof value === 'string' ? value : JSON.stringify(value);
	}
</script>

<svelte:head>
	<title>Settings · Interview Copilot</title>
</svelte:head>

<div data-testid="screen-settings">
	<Panel
		title="Settings"
		subtitle="Read-only: config has no write port. Layered precedence: default.json < env config < config/local.json < IC_ env vars."
	>
		<Tabs
			tabs={[
				{ id: 'adapters', label: groups.adapters!.label },
				{ id: 'timing', label: groups.timing!.label },
				{ id: 'storage', label: groups.storage!.label }
			]}
			bind:active
		/>

		<div class="settings-fields" role="tabpanel" id="tabpanel-{active}" aria-labelledby="tab-{active}">
			{#each fieldsFor(groups[active]!.paths) as field (field.path)}
				<div class="settings-field">
					<Input label={field.path} value={displayValue(field.value)} disabled />
					<Badge tone={layerBadgeTone(field.setBy)}>{layerLabel(field.setBy)}</Badge>
					{#if field.lockedByEnvVar}
						<Badge tone="warning">env override — locked</Badge>
					{/if}
				</div>
			{/each}
		</div>
	</Panel>
</div>

<style>
	.settings-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.settings-field {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: end;
		gap: var(--space-3);
	}

	@media (max-width: 40rem) {
		.settings-field {
			grid-template-columns: 1fr;
			align-items: start;
		}
	}
</style>
