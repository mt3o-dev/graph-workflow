/**
 * Dashboard ("The Treasury") load — P4, goes through the P3 loader contract
 * only (`loadDashboardData`), never the `Container` directly.
 */
import type { PageServerLoad } from './$types.js';
import { getContainer } from '$lib/server/ui/container-singleton.js';
import { loadDashboardData } from '$lib/server/ui/loaders.js';
import type { Granularity } from '$lib/core/analytics/model.js';
import type { AttributionMode } from '$lib/core/analytics/model.js';
import type { RollupVariant } from '$lib/core/analytics/by-group.js';

const GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month'];
const MODES: readonly AttributionMode[] = ['overlap', 'partition'];
const VARIANTS: readonly RollupVariant[] = ['self', 'rollup'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

export const load: PageServerLoad = async ({ url }) => {
	const granularity = pick(url.searchParams.get('granularity'), GRANULARITIES, 'month');
	const mode = pick(url.searchParams.get('mode'), MODES, 'partition');
	const variant = pick(url.searchParams.get('variant'), VARIANTS, 'self');

	const container = await getContainer();
	const dashboard = await loadDashboardData(container, {
		granularity,
		byGroup: { mode, variant }
	});

	return { dashboard, granularity, mode, variant };
};
