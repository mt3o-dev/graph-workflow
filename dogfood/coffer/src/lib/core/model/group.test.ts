import { describe, expect, it } from 'vitest';
import { ancestry, childrenOf, wouldCreateCycle, type Group } from './group.js';

const root: Group = { id: 'root', name: 'Food', parentId: null, kind: 'group' };
const child: Group = { id: 'child', name: 'Snacks', parentId: 'root', kind: 'group' };
const grandchild: Group = { id: 'grandchild', name: 'Chips', parentId: 'child', kind: 'group' };
const tag: Group = { id: 'tag1', name: 'Recurring', parentId: null, kind: 'tag' };
const tree = [root, child, grandchild, tag];

describe('childrenOf', () => {
	it('returns direct children of a given parent', () => {
		expect(childrenOf(tree, 'root')).toEqual([child]);
		expect(childrenOf(tree, 'child')).toEqual([grandchild]);
	});

	it('returns tree roots and parentless tags for parentId: null', () => {
		expect(childrenOf(tree, null)).toEqual([root, tag]);
	});

	it('returns [] for a leaf', () => {
		expect(childrenOf(tree, 'grandchild')).toEqual([]);
	});
});

describe('ancestry', () => {
	it('walks from a node up to the root, inclusive', () => {
		expect(ancestry(tree, 'grandchild')).toEqual([grandchild, child, root]);
	});

	it('is a single-element chain for a root', () => {
		expect(ancestry(tree, 'root')).toEqual([root]);
	});

	it('is a single-element chain for a parentless tag', () => {
		expect(ancestry(tree, 'tag1')).toEqual([tag]);
	});

	it('throws for an unknown id', () => {
		expect(() => ancestry(tree, 'nope')).toThrow();
	});
});

describe('wouldCreateCycle', () => {
	it('is false for detaching to root (newParentId: null)', () => {
		expect(wouldCreateCycle(tree, 'child', null)).toBe(false);
	});

	it('is false for a normal re-parent that stays acyclic', () => {
		expect(wouldCreateCycle(tree, 'grandchild', 'root')).toBe(false);
	});

	it('is true when a group would become its own parent', () => {
		expect(wouldCreateCycle(tree, 'root', 'root')).toBe(true);
	});

	it('is true when the new parent is a descendant of the group', () => {
		expect(wouldCreateCycle(tree, 'root', 'grandchild')).toBe(true);
		expect(wouldCreateCycle(tree, 'child', 'grandchild')).toBe(true);
	});

	it('is false for a brand-new group (not yet in `groups`) reparented anywhere existing', () => {
		expect(wouldCreateCycle(tree, 'brand-new', 'grandchild')).toBe(false);
	});
});
