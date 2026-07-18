---
id: be-011
question: "What delivery guarantees do message queues offer, and what are the tradeoffs?"
category: backend
difficulty: hard
expertise: senior
tags: [messaging, distributed-systems, reliability]
---

Message queues typically offer one of three delivery guarantees: at-most-once, where a message might be lost but never duplicated; at-least-once, where a message is guaranteed to arrive but might be delivered more than once, usually because the consumer crashed or the network dropped the ack after processing but before the broker recorded it; and exactly-once, which is the hardest to actually achieve end-to-end and usually means at-least-once delivery plus idempotent processing on the consumer side, or a transactional producer-consumer setup like Kafka's exactly-once semantics that only holds within that specific system's boundaries. In practice I design almost everything around at-least-once delivery because it's the only guarantee that's both achievable and honest across heterogeneous systems, and I push the burden of correctness onto making consumers idempotent rather than trusting the broker to dedupe for me. I also care about ordering guarantees separately from delivery guarantees — something like Kafka gives ordering per partition, not globally — and about dead-letter queues for messages that repeatedly fail, so a poison message doesn't block the whole queue.
