---
id: th-008
question: "What is an aggregate in DDD, and how do domain events relate to it?"
category: theory
difficulty: medium
expertise: mid
tags: [ddd, aggregates, domain-events, consistency-boundary]
---

An aggregate is a cluster of domain objects — entities and value objects — that are treated as a single unit for the purpose of data changes, with one designated entity acting as the aggregate root. The root is the only object outside code is allowed to hold a reference to; everything inside the aggregate is reached through it, which lets the aggregate enforce its own invariants on every operation. For example, an Order aggregate root might contain OrderLines, and the root enforces a rule like 'total can't exceed the customer's credit limit' on every mutation, so that invariant can never be violated from outside. Aggregates are also the natural transaction boundary: one transaction should generally touch exactly one aggregate, and changes across aggregates are coordinated asynchronously rather than in a single ACID transaction. That's where domain events come in — when an aggregate does something significant, like 'OrderPlaced' or 'InventoryReserved,' it raises a domain event, which other aggregates or bounded contexts subscribe to and react to independently. This keeps aggregates decoupled while still letting the system stay eventually consistent as a whole.
