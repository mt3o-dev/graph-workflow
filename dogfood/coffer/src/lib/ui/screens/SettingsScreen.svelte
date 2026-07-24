<!--
	Settings screen ("The Steward's Study") — coffer-ui-i18n P4. Groups tree +
	rules list from `loadSettings`, read-only-ish v1 per plan (no add/edit
	actions wired this phase — `settings.addGroupButton`/`addRuleButton` exist
	in the catalog for a later slice, not rendered as live actions here).
-->
<script lang="ts">
	import type { GroupDto, RuleDto, PredicateDto } from '$lib/server/ui/dto.js';
	import { childrenOf } from '$lib/core/model/group.js';
	import type { Locale } from '$lib/i18n/t.js';
	import { t } from '$lib/i18n/t.js';
	import Card from '../design-system/Card.svelte';
	import Badge from '../design-system/Badge.svelte';
	import EmptyState from '../design-system/EmptyState.svelte';

	interface Props {
		locale: Locale;
		groups: readonly GroupDto[];
		rules: readonly RuleDto[];
	}

	let { locale, groups, rules }: Props = $props();

	function predicateSummary(predicate: PredicateDto): string {
		switch (predicate.kind) {
			case 'field':
				if (predicate.field === 'amount') {
					return predicate.op === 'between'
						? `amount between ${predicate.value[0]} and ${predicate.value[1]}`
						: `amount ${predicate.op} ${predicate.value}`;
				}
				return `${predicate.field} ${predicate.op} "${predicate.value}"`;
			case 'all':
				return predicate.predicates.map(predicateSummary).join(' AND ');
			case 'any':
				return predicate.predicates.map(predicateSummary).join(' OR ');
		}
	}
</script>

<div class="cf-settings" data-testid="settings-screen">
	<header>
		<h1>{t(locale, 'settings.title')}</h1>
		<p>{t(locale, 'settings.subtitle')}</p>
	</header>

	<Card frame="plain">
		<h2>{t(locale, 'settings.groupsHeading')}</h2>
		{#if groups.length === 0}
			<EmptyState title={t(locale, 'settings.groupsEmptyState')} />
		{:else}
			{@render groupTree(null)}
		{/if}
	</Card>

	<Card frame="plain">
		<h2>{t(locale, 'settings.rulesHeading')}</h2>
		{#if rules.length === 0}
			<EmptyState title={t(locale, 'settings.rulesEmptyState')} />
		{:else}
			<ul class="cf-settings__rules" data-testid="settings-rules">
				{#each rules as rule (rule.id)}
					<li>
						<strong>{rule.name ?? rule.id}</strong>
						<span>{t(locale, 'settings.ruleOrderLabel', { order: rule.order })}</span>
						<span>{predicateSummary(rule.predicate)}</span>
						<span>{t(locale, 'settings.ruleAssignLabel')}: {rule.assign.join(', ')}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

{#snippet groupTree(parentId: string | null)}
	<ul class="cf-settings__groups" data-testid="settings-groups">
		{#each childrenOf([...groups], parentId) as group (group.id)}
			<li>
				<span>{group.name}</span>
				<Badge tone="neutral">{t(locale, group.kind === 'tag' ? 'settings.kind.tag' : 'settings.kind.group')}</Badge>
				{#if childrenOf([...groups], group.id).length > 0}
					{@render groupTree(group.id)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	.cf-settings {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-4);
	}

	.cf-settings__groups,
	.cf-settings__rules {
		list-style: none;
		padding-left: var(--cf-space-4);
	}

	.cf-settings__rules li {
		display: flex;
		gap: var(--cf-space-3);
		padding: var(--cf-space-1) 0;
		font-size: var(--cf-font-size-sm);
	}
</style>
