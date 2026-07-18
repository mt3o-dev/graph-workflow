---
id: th-017
question: "What is the difference between concurrency and parallelism?"
category: theory
difficulty: easy
expertise: junior
tags: [concurrency, parallelism, multithreading, operating-systems]
---

Concurrency is about structure: dealing with multiple tasks that are in progress at the same time, by interleaving them, even if only one is actually executing at any given instant. A single-core CPU running a web server that juggles many requests via an event loop or thread scheduler is concurrent — it switches between tasks fast enough to look simultaneous, but nothing is truly happening at once. Parallelism is about execution: actually running multiple tasks at the exact same instant, which requires multiple physical cores or machines. A concurrent program can be run in parallel if you give it multiple cores, but concurrency doesn't require parallelism, and parallelism without concurrent structure is just, say, running the same independent computation on many cores with no interleaving concerns at all. A good way I explain it: concurrency is about dealing with lots of things at once, parallelism is about doing lots of things at once. A single barista taking multiple orders and juggling drink prep is concurrency; several baristas each making a drink simultaneously is parallelism. This distinction matters because concurrency is what forces you to think about race conditions and locking, even on a single core.
