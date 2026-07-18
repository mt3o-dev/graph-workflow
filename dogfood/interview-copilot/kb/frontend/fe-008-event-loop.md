---
id: fe-008
question: "How does the JavaScript event loop process the call stack, microtasks, and macrotasks?"
category: frontend
difficulty: easy
expertise: junior
tags: [javascript, event-loop, async, promises]
---

The event loop is how JavaScript, despite being single-threaded, handles asynchronous work without blocking. Synchronous code runs on the call stack first, top to bottom. Once the stack is empty, the event loop checks the microtask queue — Promise callbacks, `queueMicrotask` — and drains it completely before doing anything else, including rendering. Only after microtasks are empty does it pull one task from the macrotask queue, things like `setTimeout` callbacks, DOM events, or I/O, run that, and then go back to draining microtasks again before the next macrotask. That ordering explains why `Promise.resolve().then()` always fires before a `setTimeout(fn, 0)`, even though both are "async" — microtasks always get priority. It also explains why a chain of `.then()` calls, or a recursive microtask that keeps scheduling itself, can starve rendering and macrotasks entirely, which is a subtle bug I've actually hit in production. Understanding this loop is what makes async code predictable instead of feeling like magic.
