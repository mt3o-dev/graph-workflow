---
id: be-019
question: "How does the CAP theorem apply in practice when designing a distributed system?"
category: backend
difficulty: hard
expertise: senior
tags: [distributed-systems, cap-theorem, consistency]
---

CAP theorem says that during a network partition, a distributed system has to choose between consistency, meaning every read sees the latest write, and availability, meaning every request gets a response even if it might be stale — you can't have both when nodes can't talk to each other. In practice this framing is a bit oversimplified because partitions are rare and brief, and the more useful everyday tradeoff is what Daniel Abadi calls PACELC: even without a partition, you're trading latency against consistency, because achieving strong consistency requires coordination between nodes, which costs time. Concretely, a system like a bank ledger favors consistency — I'd rather reject a request or wait than show an inconsistent balance, so I use synchronous replication or consensus protocols like Raft. A system like a social media feed or a shopping cart favors availability — it's fine if a like count is a few seconds stale as long as the app stays responsive, so I use asynchronous replication and eventual consistency. Most real systems mix both within one product, choosing consistency per data type based on what an inconsistency there would actually cost the business.
