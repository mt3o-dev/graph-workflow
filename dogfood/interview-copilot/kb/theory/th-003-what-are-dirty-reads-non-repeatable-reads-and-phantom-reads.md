---
id: th-003
question: "What are dirty reads, non-repeatable reads, and phantom reads?"
category: theory
difficulty: medium
expertise: mid
tags: [databases, isolation-levels, concurrency, sql]
---

These are the three classic anomalies that isolation levels are designed to prevent, and they get progressively harder to eliminate. A dirty read happens when a transaction reads data written by another transaction that hasn't committed yet — if that other transaction rolls back, you've read data that never really existed. Read uncommitted is the only level that allows this, and it's rarely used in practice. A non-repeatable read happens when a transaction reads the same row twice and gets different values because another transaction updated and committed in between; read committed still allows this, but repeatable read prevents it by holding locks or using snapshots for the duration of the transaction. A phantom read is subtler: you run the same query twice within a transaction and get a different set of rows, because another transaction inserted or deleted rows matching your predicate — repeatable read can still allow phantoms in some engines, and only serializable isolation fully prevents them, typically via range locks or serializable snapshot isolation.
