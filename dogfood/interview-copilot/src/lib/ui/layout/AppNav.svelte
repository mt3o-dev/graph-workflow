<script lang="ts">
	import { page } from '$app/state';

	// testid values match the e2e selector contract in e2e/README-e2e.md
	// (authored by the Phase 6 agent against `nav-live`/`nav-kb`/`nav-log`/
	// `nav-settings` before these routes existed).
	const links = [
		{ href: '/', label: 'Live Session', testid: 'nav-live' },
		{ href: '/knowledge', label: 'Knowledge', testid: 'nav-kb' },
		{ href: '/sessions', label: 'Sessions', testid: 'nav-log' },
		{ href: '/settings', label: 'Settings', testid: 'nav-settings' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<nav class="app-nav" aria-label="Main navigation">
	{#each links as link (link.href)}
		<a
			href={link.href}
			class="nav-link"
			data-testid={link.testid}
			aria-current={isActive(link.href) ? 'page' : undefined}
		>
			{link.label}
		</a>
	{/each}
</nav>

<style>
	.app-nav {
		display: flex;
		gap: var(--space-1);
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
		text-decoration: none;
		transition: background-color var(--duration-base) var(--ease-standard);
	}

	.nav-link:hover {
		background: var(--color-bg-sunken);
		color: var(--color-text);
	}

	.nav-link[aria-current='page'] {
		background: var(--color-brand-subtle);
		color: var(--color-brand);
	}
</style>
