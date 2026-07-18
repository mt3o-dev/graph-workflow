---
id: th-022
question: "What are the differences between processes, threads, and async I/O?"
category: theory
difficulty: medium
expertise: mid
tags: [operating-systems, processes, threads, async]
---

A process is an independent unit of execution with its own memory address space, file descriptors, and OS resources, isolated from other processes by the kernel, so a crash in one process generally can't corrupt another's memory. Communication between processes requires explicit mechanisms like pipes, sockets, or shared memory, and creating a process is relatively expensive because the OS has to set up a whole new address space. A thread lives inside a process and shares that process's memory and file descriptors with other threads in the same process, which makes communication cheap, just shared variables, but also means a bug in one thread, like a bad write through a stray pointer, can corrupt the whole process, and threads need explicit synchronization like locks to avoid race conditions on shared state. Threads are also much cheaper to create and switch between than processes since the OS doesn't need a new address space. Async I/O is a different axis entirely: instead of using OS-level preemptive threads at all, a single thread runs an event loop that issues non-blocking I/O operations and registers callbacks or resumes coroutines when they complete, which avoids both the memory overhead of many OS threads and the synchronization headaches of shared mutable state, at the cost of needing every piece of code in that loop to avoid blocking operations that would stall the whole loop.
