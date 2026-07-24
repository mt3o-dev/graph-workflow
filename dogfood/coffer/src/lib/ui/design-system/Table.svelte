<script lang="ts">
	export interface TableColumn {
		key: string;
		header: string;
		numeric?: boolean;
	}

	interface Props {
		columns: TableColumn[];
		/** Preformatted display strings only — no Intl/formatting inside the
		 * component; values arrive already locale-formatted ([node:f36237e4]). */
		rows: Record<string, string>[];
		rowKey?: (row: Record<string, string>, index: number) => string;
		/** i18n'd table caption, visually hidden but announced (caller-supplied). */
		caption?: string;
	}

	let { columns, rows, rowKey = (_row, index) => String(index), caption }: Props = $props();
</script>

<table class="cf-table">
	{#if caption}
		<caption class="cf-table__caption">{caption}</caption>
	{/if}
	<thead>
		<tr>
			{#each columns as column (column.key)}
				<th
					scope="col"
					class="cf-table__th"
					class:cf-table__th--numeric={column.numeric}
				>
					{column.header}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row, index (rowKey(row, index))}
			<tr class="cf-table__row">
				{#each columns as column (column.key)}
					<td class="cf-table__td" class:cf-table__td--numeric={column.numeric}>
						{row[column.key]}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.cf-table {
		width: 100%;
		border-collapse: collapse;
		background: var(--cf-color-data-bg);
		color: var(--cf-color-data-text);
		font-family: var(--cf-font-data);
		font-size: var(--cf-font-size-sm);
	}

	.cf-table__caption {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.cf-table__th {
		text-align: left;
		font-weight: var(--cf-font-weight-bold);
		padding: var(--cf-space-2) var(--cf-space-3);
		border-bottom: 2px solid var(--cf-color-data-grid);
		color: var(--cf-color-text-muted);
	}

	.cf-table__td {
		padding: var(--cf-space-2) var(--cf-space-3);
		border-bottom: 1px solid var(--cf-color-data-grid);
	}

	.cf-table__row:last-child .cf-table__td {
		border-bottom: none;
	}

	/* Numeric columns: tabular figures so digits align across rows, and
	 * right-aligned per convention for scannable magnitude comparison. */
	.cf-table__th--numeric,
	.cf-table__td--numeric {
		text-align: right;
		font-variant-numeric: var(--cf-font-variant-numeric);
		font-feature-settings: 'tnum' 1;
	}
</style>
