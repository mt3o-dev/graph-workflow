---
id: th-024
question: "What are the benefits of immutability, and how do they relate to functional versus OOP tradeoffs?"
category: theory
difficulty: medium
expertise: mid
tags: [immutability, functional-programming, oop, design]
---

Immutability means once an object is created, it can never be changed — any 'modification' produces a new object instead of mutating the existing one. The big payoff is that immutable data is inherently thread-safe with no locking needed, since there's no way for one thread to observe another thread's in-progress mutation; it also makes reasoning about code far easier, because a reference to an object is a guarantee about its value forever, not just at the moment you read it, which eliminates a whole class of aliasing bugs where two parts of a program unexpectedly share and mutate the same object. This is the philosophical core of functional programming: functions are pure, taking inputs and returning outputs without mutating shared state, which makes code composable, testable in isolation, and easy to parallelize. OOP, by contrast, is built around encapsulated, often mutable state and objects sending messages that change each other's internals, which models real-world stateful processes intuitively but makes concurrency and reasoning about 'what changed when' harder. In practice, most production code isn't purely one or the other — I favor immutable value objects and pure functions for data and business logic, while still using OOP-style encapsulation and controlled mutable state for things that are inherently stateful, like a database connection pool or a UI widget tree.
