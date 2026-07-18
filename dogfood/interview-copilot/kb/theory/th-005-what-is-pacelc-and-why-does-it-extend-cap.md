---
id: th-005
question: "What is PACELC and why does it extend CAP?"
category: theory
difficulty: hard
expertise: senior
tags: [distributed-systems, pacelc, cap-theorem, latency]
---

PACELC is an extension of CAP that I find more honest about how distributed systems actually behave, because CAP only describes the tradeoff during a network partition, and partitions are rare compared to normal operation. PACELC says: if there's a Partition, you choose between Availability and Consistency, Else, even when the network is healthy, you still choose between Latency and Consistency. That second half matters a lot in day-to-day operation — a system like DynamoDB that's PA/EL chooses availability under partition and low latency otherwise, accepting eventual consistency even when everything is working fine, because synchronously confirming a write across replicas costs latency. A system like a traditional single-leader relational database with synchronous replicas is more PC/EC: it sacrifices both availability during partitions and latency during normal operation to guarantee strong consistency. When I'm choosing a datastore, I use PACELC to ask not just 'what happens during an outage' but 'what am I paying on every single request, all the time,' which is usually the more relevant question for user-facing latency budgets.
