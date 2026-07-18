---
id: fe-020
question: "How does fine-grained reactivity work in Svelte 5 with runes?"
category: frontend
difficulty: hard
expertise: senior
tags: [svelte, runes, reactivity, signals]
---

Svelte 5 replaces the older compiler-inferred reactivity, where any assignment to a top-level variable triggered an update, with explicit runes like `$state`, `$derived`, and `$effect` that work the same way inside or outside `.svelte` files, even in plain `.js` modules. `$state` wraps a value in a reactive proxy, so mutations to it — including nested object or array mutations — are tracked at the property level rather than Svelte 4's coarser, sometimes surprising reactivity around assignment statements. `$derived` computes a value from other reactive state and only recalculates when its actual dependencies change, tracked automatically by which state was read during evaluation, similar to a computed signal. `$effect` runs side effects in response to state changes it read, cleaning up before each re-run. Under the hood this is a signals-based system, closer to what SolidJS does, giving fine-grained updates — only the specific DOM bindings touching changed state re-run, not a whole component re-render. It's a real mental model shift from Svelte 4's implicit reactivity, but it fixes edge cases around reactivity in class fields, stores, and code outside components.
