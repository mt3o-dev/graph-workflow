---
id: bh-010
question: "Tell me about a production incident you handled."
category: behavioral
difficulty: hard
expertise: senior
tags: [incident, on-call, cache, checkout, postmortem]
---

I was on call when our checkout service started throwing five-hundred errors at roughly fifteen percent of requests during a normal Tuesday afternoon, no deploy had gone out and no obvious trigger existed. I pulled up dashboards first rather than guessing, and noticed our Redis cache hit rate had dropped to near zero right when the errors started, which meant every request was falling through to a slower database path that was timing out under load it wasn't sized for. I declared an incident, pulled in a database engineer, and while they investigated the cache cluster, I shipped a quick mitigation: a circuit breaker that let requests skip the cache layer entirely and hit the database with a longer timeout and lower concurrency, which stopped the cascading failures within about six minutes. It turned out an automatic Redis failover had swapped in a cold replica with an empty cache. Once the cache warmed back up, we removed the circuit breaker. In the postmortem I pushed for two changes: a cache-warming step on failover and an alert on cache hit-rate drops before error rates spike, both of which caught a similar issue months later before it became customer-facing.
