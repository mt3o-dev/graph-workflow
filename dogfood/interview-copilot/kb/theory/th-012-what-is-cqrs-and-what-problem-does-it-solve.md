---
id: th-012
question: "What is CQRS and what problem does it solve?"
category: theory
difficulty: hard
expertise: senior
tags: [cqrs, architecture, event-sourcing, scalability]
---

CQRS, Command Query Responsibility Segregation, means splitting the model you use to write data from the model you use to read it, instead of using one unified model for both, which is what most CRUD frameworks default to. On the write side, commands go through a model built around enforcing invariants — often the DDD aggregates we talked about — validating business rules before anything is persisted. On the read side, queries hit a separate model, often a denormalized, pre-joined view optimized purely for how the UI or API needs to display data, with no business logic at all. The problem this solves is that a single model trying to serve both purposes tends to compromise on both: it's either over-normalized and slow for reads, or denormalized in ways that make write-side invariant enforcement awkward. CQRS also unlocks independent scaling — you might have one write node and many read replicas or read-optimized stores like Elasticsearch. The tradeoff is complexity and, if you sync the two models asynchronously, eventual consistency between what you just wrote and what queries return, which is why I only reach for full CQRS when the read and write shapes have genuinely diverged, not as a default.
