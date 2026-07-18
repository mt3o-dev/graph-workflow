---
id: th-023
question: "What are the common garbage collection strategies and their tradeoffs?"
category: theory
difficulty: hard
expertise: senior
tags: [memory-management, garbage-collection, runtime, performance]
---

Reference counting is the simplest strategy: every object tracks how many references point to it, and it's freed the instant that count hits zero, which gives deterministic, immediate collection with no unpredictable pauses. Its major weakness is cyclic references, where two objects reference each other but nothing external references either, so the count never reaches zero and they leak unless a separate cycle detector runs, which Python uses alongside its reference counting. Mark-and-sweep starts from a set of roots, like global variables and stack frames, and traverses all reachable objects, marking them live; anything unmarked after the traversal is garbage and gets swept. This naturally handles cycles since unreachable cycles just never get marked, but a naive implementation stops the whole program during collection, causing pause times that scale with heap size. Generational collectors, used by the JVM and V8, build on mark-and-sweep with the empirical observation that most objects die young: they split the heap into a young generation, collected frequently and cheaply since it's small, and an old generation for objects that survive several collections, collected rarely. Concurrent and incremental collectors, like Go's or ZGC, try to do most of the marking work alongside the running program rather than stopping it, trading some throughput and complexity for dramatically shorter pause times, which matters a lot for latency-sensitive services.
