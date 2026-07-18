---
id: bh-012
question: "Tell me about a time you had to learn a new technology quickly."
category: behavioral
difficulty: easy
expertise: mid
tags: [learning, kafka, event-driven, ramp-up]
---

We decided to move our order pipeline from synchronous REST calls between services to an event-driven model using Kafka, and I was asked to lead the implementation despite having only read about Kafka conceptually before. I gave myself a tight, practical ramp-up: two days of official documentation and a short course focused specifically on producer and consumer semantics, partitioning, and delivery guarantees, since those are the concepts that actually cause production bugs if misunderstood. Rather than trying to learn everything, I built a small throwaway prototype that published order-created events and consumed them into two test services, deliberately trying to break it with duplicate messages and consumer restarts so I'd understand exactly-once versus at-least-once tradeoffs firsthand instead of just reading about them. That hands-on prototype surfaced questions no article had answered, like how our specific ordering guarantees needed partition keys tied to order ID. Within two weeks I had a working design doc that survived architecture review with only minor changes. My approach to fast learning is always to build something small and adversarial early rather than consuming material passively.
