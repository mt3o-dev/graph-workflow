---
id: th-001
question: "Explain the ACID properties of a database transaction."
category: theory
difficulty: medium
expertise: mid
tags: [databases, transactions, acid, sql]
---

ACID is the set of guarantees a database gives around transactions so I can reason about correctness even under failures and concurrent access. Atomicity means a transaction is all-or-nothing: if any part fails, the whole thing rolls back, usually implemented via a write-ahead log that lets the engine undo partial work. Consistency means the transaction moves the database from one valid state to another, respecting constraints, foreign keys, and triggers — this one is partly enforced by the engine and partly by the application's own invariants. Isolation controls how concurrent transactions see each other's uncommitted changes, governed by isolation levels like read committed, repeatable read, and serializable, each trading off correctness for throughput. Durability guarantees that once a transaction commits, it survives crashes, typically through fsync'd logs and replication. In practice I think about ACID whenever I design anything involving money, inventory, or state machines, because violating any one of these silently corrupts data in ways that are very hard to detect later.
