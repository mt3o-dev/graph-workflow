/**
 * Domain model: Group/Tag ([dec:91d27d36], [dec:6] core purity).
 *
 * Pure TS only — no `node:` imports, no runtime libraries (boundary-lint
 * enforces this for everything under src/lib/core/**).
 *
 * A `Group` is a single node type for both a nestable classification tree
 * AND a flat, cross-cutting tag: `kind` distinguishes a tree node
 * (`'group'`, may have a `parentId`) from a tag (`'tag'`, conventionally
 * parentless). This refines [dec:6]'s "both just Group nodes with an
 * optional parent" prose with an explicit discriminator so a tree *root*
 * (parentId: null, kind: 'group') is distinguishable from a flat tag
 * (parentId: null, kind: 'tag') — see [dec:91d27d36].
 */

export type GroupKind = 'group' | 'tag';

export interface Group {
	readonly id: string;
	readonly name: string;
	/** Parent group id, or null for a tree root / a flat tag. */
	readonly parentId: string | null;
	readonly kind: GroupKind;
}

/** Direct children of `parentId` (null = tree roots), in input order. */
export function childrenOf(groups: readonly Group[], parentId: string | null): Group[] {
	return groups.filter((g) => g.parentId === parentId);
}

/**
 * The ancestry chain of `id`, starting with `id`'s own group and walking up
 * through each `parentId` to the root. Throws if `id` is not present in
 * `groups`. A malformed graph (a parent reference that itself doesn't
 * resolve) simply stops the walk at the last resolvable ancestor rather than
 * throwing, since `wouldCreateCycle` is what guards graph integrity going
 * in — this helper is a read, not a validator.
 */
export function ancestry(groups: readonly Group[], id: string): Group[] {
	const byId = new Map(groups.map((g) => [g.id, g] as const));
	const self = byId.get(id);
	if (!self) {
		throw new Error(`ancestry: no group with id ${id}`);
	}
	const chain: Group[] = [self];
	const seen = new Set<string>([id]);
	let current = self;
	while (current.parentId !== null) {
		const parent = byId.get(current.parentId);
		if (!parent || seen.has(parent.id)) {
			// Missing parent, or we've already visited it (a pre-existing cycle
			// in stored data) — stop rather than loop forever.
			break;
		}
		chain.push(parent);
		seen.add(parent.id);
		current = parent;
	}
	return chain;
}

/**
 * True if setting `id`'s parent to `newParentId` would create (or already
 * reflects) a cycle — i.e. `newParentId` is `id` itself, or `id` appears
 * among `newParentId`'s ancestors. `newParentId: null` (detaching to root)
 * never creates a cycle. Groups not yet present in `groups` (a brand-new
 * group being inserted) are treated as having no existing ancestry of their
 * own, so only the *target* parent's chain is walked.
 */
export function wouldCreateCycle(
	groups: readonly Group[],
	id: string,
	newParentId: string | null
): boolean {
	if (newParentId === null) {
		return false;
	}
	if (newParentId === id) {
		return true;
	}
	const byId = new Map(groups.map((g) => [g.id, g] as const));
	const seen = new Set<string>();
	let current: string | null = newParentId;
	while (current !== null) {
		if (current === id) {
			return true;
		}
		if (seen.has(current)) {
			// Pre-existing cycle among ancestors, unrelated to `id` — not this
			// helper's concern to fix, just don't loop forever.
			return false;
		}
		seen.add(current);
		const parent = byId.get(current);
		current = parent ? parent.parentId : null;
	}
	return false;
}
