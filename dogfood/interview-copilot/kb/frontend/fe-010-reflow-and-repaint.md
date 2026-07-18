---
id: fe-010
question: "What causes browser reflow and repaint, and how do you minimize them?"
category: frontend
difficulty: medium
expertise: mid
tags: [rendering, performance, reflow, repaint, dom]
---

Reflow, also called layout, happens when the browser has to recalculate the geometry of elements — size and position — because something changed that affects layout, like adding a DOM node, changing an element's width, or reading a layout property like `offsetHeight` right after a style change. Repaint happens when appearance changes without affecting geometry, like a background color, and is cheaper. Both block the main thread and can cause jank if triggered repeatedly in a tight loop, which is the classic "layout thrashing" bug — read a layout property, write a style, read again, alternating in a loop forces the browser to recalculate layout synchronously every time instead of batching. To minimize this I batch DOM reads and writes separately, use `transform` and `opacity` for animations since those can run on the compositor without triggering layout or paint at all, and avoid inline style changes inside loops in favor of toggling a class. For heavy list updates I also use `will-change` sparingly and virtualization to keep the number of live DOM nodes small.
