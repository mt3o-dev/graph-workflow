---
id: be-010
question: "What caching strategies do you know, and how do you handle cache invalidation?"
category: backend
difficulty: medium
expertise: mid
tags: [caching, performance, redis]
---

I think about caching in layers: a CDN or edge cache for static and cacheable public responses, an application-level cache like Redis for computed results or session data, and a database-level cache like a query cache or materialized view for expensive aggregations. The two hard problems are choosing a strategy and handling invalidation. For strategy, cache-aside — read from cache, on miss read from the DB and populate the cache — is the most common because it's simple and resilient to cache failures; write-through keeps cache and DB in sync on every write at the cost of write latency; write-behind batches writes for throughput but risks data loss on crash. For invalidation, I use short TTLs as a safety net everywhere, and for correctness-sensitive data I invalidate explicitly on write, either by deleting the key or publishing an event other services subscribe to. I'm careful about cache stampedes — many requests missing the same hot key at once — which I mitigate with request coalescing or a short lock around the recompute. Stale cache bugs are usually invalidation bugs, so I keep invalidation logic as close to the write path as possible.
