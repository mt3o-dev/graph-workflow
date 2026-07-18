---
id: th-004
question: "Explain the CAP theorem."
category: theory
difficulty: easy
expertise: junior
tags: [distributed-systems, cap-theorem, availability, consistency]
---

CAP theorem says that in a distributed system, when a network partition happens, you can only guarantee at most two of three properties: Consistency, Availability, and Partition tolerance — and since networks do fail, partition tolerance isn't really optional, so in practice the real choice is between consistency and availability during a partition. Consistency here means every read sees the most recent write, as if there were a single copy of the data. Availability means every request gets a non-error response, even if it might not be the latest data. If a network splits a cluster into two groups that can't talk to each other, a CP system will refuse to serve requests on the side that can't confirm it has the latest data, prioritizing correctness, while an AP system will keep answering on both sides and reconcile the divergence later. I use this when picking a database: something like a relational database configured for strong consistency leans CP, while systems like DynamoDB or Cassandra typically lean AP by default, though many let you tune per-operation.
