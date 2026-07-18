---
id: be-020
question: "What are the tradeoffs of event sourcing compared to traditional CRUD persistence?"
category: backend
difficulty: hard
expertise: senior
tags: [event-sourcing, cqrs, architecture]
---

Event sourcing stores every state change as an immutable, append-only sequence of events instead of just the current state, and you derive current state by replaying events, often materialized into read-optimized projections for querying. The upside is a complete audit trail for free, the ability to replay history to debug or reconstruct any past state, and the ability to build new read models from the same event log later without touching the write side. It also fits naturally with CQRS, separating the write model, the event log, from read models optimized for specific queries. The costs are real, though: it's a significant mental model shift for a team, queries against current state require either replaying events, which is slow at scale, or maintaining projections, which adds infrastructure and eventual-consistency lag between write and read sides. Schema evolution is hard, because old events must remain readable forever as your event types evolve, which usually means versioning event schemas and writing upcasting logic. I reach for event sourcing selectively, for domains where the audit trail and history genuinely matter, like financial transactions or inventory, not as a default architecture for every service.
