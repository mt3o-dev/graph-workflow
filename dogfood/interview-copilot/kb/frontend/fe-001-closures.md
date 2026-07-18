---
id: fe-001
question: "What is a closure in JavaScript, and can you give a practical use case?"
category: frontend
difficulty: easy
expertise: junior
tags: [javascript, closures, scope, functions]
---

A closure is what happens when a function keeps access to variables from the scope it was defined in, even after that outer function has returned. JavaScript functions capture their lexical environment, not just the values at call time, so the inner function can still read and update those outer variables later. A classic use case is a counter factory: `makeCounter()` returns an inner function that closes over a `count` variable, and each call to that returned function increments and returns `count` without exposing it globally. I use closures constantly for things like memoization, where I cache results in a variable hidden inside the closure, or for event handlers that need to remember some configuration passed in when they were created, like a debounce function that closes over a timer id. The main gotcha is closures in loops — if you close over a `var` inside a loop, every closure shares the same variable, which is why `let` or an IIFE is used to give each iteration its own binding.
