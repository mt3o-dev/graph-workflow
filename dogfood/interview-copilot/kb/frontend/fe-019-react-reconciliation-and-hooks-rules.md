---
id: fe-019
question: "How does React's reconciliation algorithm decide what to re-render, and why do the Rules of Hooks exist?"
category: frontend
difficulty: hard
expertise: senior
tags: [react, reconciliation, hooks, fiber]
---

React's reconciliation compares the new element tree produced by a render to the previous one and computes the minimal set of DOM mutations needed, rather than rebuilding the DOM from scratch. It's a heuristic diff, not a general tree-diff algorithm, built on a few assumptions for speed: elements of different types produce entirely different subtrees, so React tears down and rebuilds rather than diffing children; and for lists, it uses the `key` prop to match elements across renders, which is why a stable, unique key matters — an index key can cause React to misattribute state to the wrong item when the list reorders. Fiber, React's underlying architecture, lets this diffing work be split into units and interrupted for higher-priority updates, which is what enables concurrent features. The Rules of Hooks — only call hooks at the top level, only from React functions, in the same order every render — exist because React tracks hook state by call order in a linked list per fiber, not by name; a hook inside a conditional would shift every subsequent hook's position and silently corrupt state across renders.
