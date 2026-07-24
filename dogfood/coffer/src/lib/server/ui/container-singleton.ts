/**
 * Lazy singleton `Container` accessor for hooks/actions (coffer-ui-i18n
 * slice 4, P3). One process-lifetime `Container` (config from env via the
 * default `LayeredConfigAdapter`, [dec:11]) so every `+page.server.ts`
 * load/action shares the same SQLite connections instead of opening a new
 * one per request. Constructed and `init()`-ed (migrations) on first use,
 * memoized after.
 *
 * Test seam: `resetContainerSingleton()` clears the memoized instance so
 * each test gets a fresh one, and every `src/lib/server/ui/*` function below
 * this file takes the `Container` as an explicit parameter rather than
 * reaching for the singleton itself — the singleton is a convenience for
 * route glue (`+page.server.ts`), not something the DTO/loader layer
 * depends on internally. This keeps `serialize.ts`/`loaders.ts` testable
 * against the in-memory fakes without touching module-level state at all.
 */
import { Container } from '../container.js';

let containerPromise: Promise<Container> | undefined;

/** The shared, lazily-initialized `Container` for this process. Safe to call from concurrent loads — memoizes the in-flight promise, not just the result. */
export function getContainer(): Promise<Container> {
	if (!containerPromise) {
		containerPromise = (async () => {
			const container = new Container();
			await container.init();
			return container;
		})();
	}
	return containerPromise;
}

/** Test-only: drop the memoized singleton so the next `getContainer()` call constructs a fresh `Container`. */
export function resetContainerSingleton(): void {
	containerPromise = undefined;
}
