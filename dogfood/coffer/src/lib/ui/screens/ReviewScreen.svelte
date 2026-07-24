<!--
	Review screen ("The Scriptorium") — coffer-ui-i18n P4. Review-queue table
	(unclassified transactions), a group-assign form per row (routes through
	`performAssign`), a suggest button gated on assist availability
	(`performSuggest` returns `[]` when `assist.enabled` is off — the button is
	always offered, the empty result IS the gate), and a promote-to-rule
	action (`performPromoteRule`). Each row round-trips its `TransactionDto`
	through a hidden JSON field, exactly the contract `loaders.ts`'
	`performAssign`/`performPromoteRule` documents ("the review-queue screen
	echoes back the DTO it was handed").
-->
<script lang="ts">
	import type { TransactionDto, GroupDto, SuggestionDto } from '$lib/server/ui/dto.js';
	import type { Locale } from '$lib/i18n/t.js';
	import { t } from '$lib/i18n/t.js';
	import { formatMoney, formatDate } from '$lib/i18n/format.js';
	import Button from '../design-system/Button.svelte';
	import AmountText from '../design-system/AmountText.svelte';
	import EmptyState from '../design-system/EmptyState.svelte';

	interface ActiveSuggestions {
		readonly contentHash: string;
		readonly suggestions: readonly SuggestionDto[];
	}

	interface Props {
		locale: Locale;
		queue: readonly TransactionDto[];
		groups: readonly GroupDto[];
		activeSuggestions?: ActiveSuggestions;
	}

	let { locale, queue, groups, activeSuggestions }: Props = $props();

	function serialize(tx: TransactionDto): string {
		return JSON.stringify(tx);
	}
</script>

<div class="cf-review" data-testid="review-screen">
	<header>
		<h1>{t(locale, 'review.title')}</h1>
		<p>{t(locale, 'review.subtitle')}</p>
	</header>

	{#if queue.length === 0}
		<EmptyState title={t(locale, 'review.emptyState')} />
	{:else}
		<table class="cf-review__table" data-testid="review-table">
			<caption class="cf-review__caption">{t(locale, 'review.tableCaption')}</caption>
			<thead>
				<tr>
					<th scope="col">{t(locale, 'review.dateHeading')}</th>
					<th scope="col">{t(locale, 'review.descriptionHeading')}</th>
					<th scope="col">{t(locale, 'review.counterpartyHeading')}</th>
					<th scope="col">{t(locale, 'review.amountHeading')}</th>
					<th scope="col">{t(locale, 'review.groupsSelectLabel')}</th>
					<th scope="col"></th>
				</tr>
			</thead>
			<tbody>
				{#each queue as tx (tx.contentHash)}
					<tr data-testid="review-row" data-content-hash={tx.contentHash}>
						<td>{formatDate(tx.bookingDate, locale)}</td>
						<td>{tx.description}</td>
						<td>{tx.counterparty}</td>
						<td>
							<AmountText
								value={formatMoney(tx.amount.minor, tx.amount.currency, locale)}
								sign={tx.direction === 'out' ? 'negative' : 'positive'}
							/>
						</td>
						<td colspan="2">
							<form method="POST" class="cf-review__form" data-testid="review-assign-form">
								<input type="hidden" name="tx" value={serialize(tx)} />
								<select
									name="groupIds"
									multiple
									aria-label={t(locale, 'review.groupsSelectLabel')}
									data-testid="review-group-select"
								>
									{#each groups as group (group.id)}
										<option value={group.id}>{group.name}</option>
									{/each}
								</select>
								<div class="cf-review__actions">
									<Button type="submit" formaction="?/assign" variant="primary">
										{t(locale, 'review.assignButton')}
									</Button>
									<Button type="submit" formaction="?/suggest" variant="secondary">
										{t(locale, 'review.suggestButton')}
									</Button>
									<Button type="submit" formaction="?/promote" variant="ghost">
										{t(locale, 'review.promoteButton')}
									</Button>
								</div>
							</form>
							{#if activeSuggestions && activeSuggestions.contentHash === tx.contentHash}
								<div data-testid="review-suggestions">
									{#if activeSuggestions.suggestions.length === 0}
										<p>{t(locale, 'review.noSuggestions')}</p>
									{:else}
										<ul>
											{#each activeSuggestions.suggestions as suggestion (suggestion.groupId)}
												<li>
													{suggestion.reason} —
													{t(locale, 'review.confidenceLabel', { percent: Math.round(suggestion.confidence * 100) })}
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.cf-review__table {
		width: 100%;
		border-collapse: collapse;
		background: var(--cf-color-data-bg);
		color: var(--cf-color-data-text);
		font-size: var(--cf-font-size-sm);
	}

	.cf-review__caption {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.cf-review__table th,
	.cf-review__table td {
		padding: var(--cf-space-2) var(--cf-space-3);
		border-bottom: 1px solid var(--cf-color-data-grid);
		text-align: left;
		vertical-align: top;
	}

	.cf-review__form {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-2);
	}

	.cf-review__actions {
		display: flex;
		gap: var(--cf-space-2);
	}
</style>
