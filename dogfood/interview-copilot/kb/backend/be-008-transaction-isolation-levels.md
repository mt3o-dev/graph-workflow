---
id: be-008
question: "What are database transaction isolation levels, and what anomalies do they prevent?"
category: backend
difficulty: hard
expertise: senior
tags: [database, transactions, concurrency]
---

The SQL standard defines four isolation levels — Read Uncommitted, Read Committed, Repeatable Read, and Serializable — each preventing a different set of anomalies at the cost of more locking or more retries. Read Uncommitted allows dirty reads, seeing another transaction's uncommitted changes; almost nobody uses it. Read Committed, Postgres's default, prevents dirty reads but allows non-repeatable reads, where re-running the same query in one transaction sees different data because another transaction committed in between. Repeatable Read, MySQL's default, additionally prevents non-repeatable reads but can still allow phantom reads in the strict standard, though Postgres's implementation of Repeatable Read actually prevents phantoms too via snapshot isolation. Serializable is the strictest, giving results equivalent to some serial execution of all transactions, but it achieves this by detecting conflicts and aborting one transaction, so your application must retry on serialization failures. In practice I default to Read Committed for most OLTP work, reach for Repeatable Read or explicit row locks for read-then-write logic like decrementing inventory, and only pay for Serializable when correctness genuinely requires it, since it hurts throughput under contention.
