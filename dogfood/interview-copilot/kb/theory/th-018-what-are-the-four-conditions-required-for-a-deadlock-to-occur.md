---
id: th-018
question: "What are the four conditions required for a deadlock to occur?"
category: theory
difficulty: medium
expertise: mid
tags: [concurrency, deadlock, operating-systems, locking]
---

A deadlock happens when a set of threads or processes are stuck permanently waiting on each other, and it requires all four of Coffman's conditions to hold simultaneously, which is useful because breaking any single one prevents deadlock entirely. Mutual exclusion means a resource can only be held by one thread at a time, like a mutex-protected object. Hold and wait means a thread is holding at least one resource while waiting to acquire another. No preemption means a resource can't forcibly be taken away from a thread; it has to be released voluntarily. And circular wait means there's a cycle of threads, each waiting for a resource held by the next one in the cycle. A classic example is thread A holding lock 1 and waiting for lock 2, while thread B holds lock 2 and waits for lock 1. In practice, I prevent deadlocks mostly by attacking circular wait, since the other three are often inherent to the problem: I enforce a strict global ordering on lock acquisition so every thread always requests locks in the same sequence, which makes a cycle impossible, or I use timeouts on lock acquisition so a stuck thread backs off and retries instead of waiting forever.
