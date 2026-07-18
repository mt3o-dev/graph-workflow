---
id: be-009
question: "What's the difference between optimistic and pessimistic locking?"
category: backend
difficulty: medium
expertise: mid
tags: [database, concurrency, locking]
---

Pessimistic locking assumes conflicts are likely, so it acquires a lock on a row up front — SELECT ... FOR UPDATE — and holds it until the transaction commits, blocking other transactions from touching that row in the meantime. It guarantees no lost updates but reduces concurrency and can cause deadlocks or long queues if transactions are slow or held open too long. Optimistic locking assumes conflicts are rare: instead of locking, you read a row along with a version number or timestamp, do your work, and on write you check that the version hasn't changed, typically with a WHERE version = expected_version clause; if zero rows are updated, someone else won, and you retry or surface a conflict to the user. Optimistic locking scales much better under low-contention, high-read workloads, which describes most web applications, while pessimistic locking is the right call for high-contention scenarios like seat reservations or financial ledgers where retry storms would be worse than blocking. I default to optimistic locking and only switch to pessimistic when I see repeated conflict-driven retries in practice.
