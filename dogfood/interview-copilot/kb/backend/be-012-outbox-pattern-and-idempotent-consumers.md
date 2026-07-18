---
id: be-012
question: "What is the outbox pattern, and why do consumers need to be idempotent?"
category: backend
difficulty: hard
expertise: senior
tags: [messaging, distributed-systems, outbox-pattern, idempotency]
---

When a service needs to update its database and publish an event as part of the same logical operation, you can't just do both separately, because a crash between the DB commit and the publish leaves them inconsistent — that's the classic dual-write problem. The outbox pattern solves it by writing the event into an "outbox" table in the same database transaction as the business data change, so both succeed or fail atomically. A separate relay process, or a change-data-capture tool like Debezium, then reads new outbox rows and publishes them to the message broker, marking them as sent, guaranteeing the event is eventually published at least once. Because it's at-least-once, not exactly-once, consumers on the other end must be idempotent: they need to detect and ignore duplicate messages, typically by storing a processed-message ID or using the business operation's natural idempotency key, so replaying the same event twice doesn't double-apply an effect like charging a customer twice. I use this pattern anywhere a state change must reliably trigger downstream side effects, like order placement triggering inventory reservation and notification.
