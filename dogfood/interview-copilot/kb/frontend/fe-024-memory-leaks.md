---
id: fe-024
question: "What are common causes of memory leaks in a web app, and how do you diagnose one?"
category: frontend
difficulty: hard
expertise: senior
tags: [memory-leaks, performance, debugging, devtools]
---

The most common leak I see in web apps is event listeners or subscriptions that outlive the component that created them — attaching a listener to `window` or a global event bus in a mount hook and forgetting the cleanup, so every mount adds another listener that never goes away and keeps closing over stale component state. Timers are another classic: an interval or timeout that keeps a reference to a component alive after it's unmounted. Detached DOM nodes are a subtler one — holding a reference to a DOM element in a JS variable or closure after it's removed from the tree keeps the whole subtree from being garbage collected. To diagnose, I use the Chrome DevTools Memory panel: take a heap snapshot, perform the suspected leaking action several times, take another snapshot, and use the comparison view to see which object types kept growing. Retainer paths in that view show exactly what's holding the reference, which is usually more useful than guessing. To confirm a leak exists at all first, I watch the Performance panel's memory graph for a sawtooth that never returns to baseline after garbage collection, rather than one that keeps climbing.
