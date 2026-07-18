---
id: th-019
question: "What is a memory model, and how do race conditions arise from it?"
category: theory
difficulty: hard
expertise: senior
tags: [concurrency, memory-model, race-conditions, cpu-architecture]
---

A memory model defines the rules for what guarantees a program has about the order and visibility of reads and writes to shared memory across multiple threads or cores, and it exists because both compilers and CPUs aggressively reorder instructions and cache values in per-core caches for performance, as long as a single thread can't observe the reordering. The problem is that under concurrency, another thread can observe it, because it might be reading from its own stale cache line or seeing writes in a different order than the program issued them. A race condition arises when two threads access the same memory location concurrently, at least one is a write, and there's no synchronization establishing an ordering between them — the outcome then depends on timing, which is nondeterministic and can differ between runs or hardware. Languages address this with an explicit memory model, like the Java Memory Model or C++11's model, which defines 'happens-before' relationships: operations like acquiring a lock, or in some languages a volatile write, create synchronization points that force visibility and prevent reordering across them. Practically, this means I never assume a plain variable write on one thread is immediately visible on another without going through a mutex, atomic, or a channel — those are what actually establish the happens-before edge.
