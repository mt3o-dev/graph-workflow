---
id: th-025
question: "How do distributed transactions work, and what is the saga pattern?"
category: theory
difficulty: hard
expertise: senior
tags: [distributed-systems, sagas, distributed-transactions, microservices]
---

A classic distributed transaction uses two-phase commit: a coordinator asks every participant to prepare and vote whether they can commit, and only if all participants vote yes does it send a commit message to everyone; if any votes no, everyone rolls back. This gives strong atomicity across services, but it comes at a real cost — participants hold locks while waiting for the coordinator's decision, so if the coordinator crashes after the prepare phase, participants can be stuck blocked indefinitely, and the whole approach doesn't scale well across many services or across network boundaries with unreliable connectivity, which is why it's rarely used across microservices in practice. The saga pattern is the alternative that trades strong atomicity for availability and scalability: instead of one atomic transaction, a saga is a sequence of local transactions, each committing independently in its own service, where each step publishes an event or is invoked directly to trigger the next step. If a step fails partway through, instead of rolling back like a database transaction, the saga runs compensating actions for every step that already succeeded, undoing their effects with an explicit inverse operation, like refunding a payment instead of the payment 'not having happened.' Sagas can be coordinated centrally by an orchestrator that explicitly calls each step, or choreographed, where each service reacts to events from the previous one with no central coordinator; I lean toward orchestration once there are more than a handful of steps, because it keeps the failure and compensation logic visible in one place rather than scattered across services.
