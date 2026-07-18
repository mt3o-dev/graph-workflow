---
id: be-018
question: "What is database sharding, and how do you choose a shard key?"
category: backend
difficulty: hard
expertise: senior
tags: [database, sharding, scalability]
---

Sharding is horizontal partitioning of data across multiple database instances so no single machine has to hold or serve the entire dataset, which is how you scale writes and total storage past what one server can handle — vertical scaling and read replicas only get you so far, especially for write-heavy workloads. The critical decision is the shard key, the column used to decide which shard a row lives on. A good shard key distributes data and query load evenly, avoiding hot shards, and aligns with your most common query patterns so most queries hit a single shard rather than needing to fan out and merge results across all of them — for a multi-tenant SaaS product, tenant ID is often a natural shard key because nearly every query is already scoped to one tenant. Bad shard key choices, like sharding by creation timestamp, create hot shards where all recent traffic lands on one node. Sharding also makes cross-shard transactions, joins, and unique constraints much harder, so I only reach for it once vertical scaling and read replicas are genuinely insufficient, since it adds real operational and application complexity.
