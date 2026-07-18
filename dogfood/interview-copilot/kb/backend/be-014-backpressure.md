---
id: be-014
question: "What is backpressure, and how do you handle it in a distributed system?"
category: backend
difficulty: medium
expertise: mid
tags: [distributed-systems, backpressure, scalability]
---

Backpressure is a signal that a consumer or downstream system can't keep up with the rate producers are sending work, and handling it well means slowing down or shedding load gracefully instead of buffering unboundedly until something crashes with an out-of-memory error. In a queue-based system, backpressure shows up as growing queue depth, and I handle it by having consumers pull work at their own pace rather than having producers push, bounding queue size so producers block or get rejected once it's full, and autoscaling consumers based on queue depth. In synchronous request paths, I apply backpressure with bounded thread or connection pools plus fast failure — returning 503 with Retry-After once a service is saturated, instead of queuing requests indefinitely and letting latency spiral. Reactive streaming libraries and protocols like gRPC and TCP itself have backpressure built in at the transport level via flow control windows. The key mindset is that an unbounded buffer isn't a fix for backpressure, it's just a way to delay and worsen the failure, so I always put explicit bounds and shedding strategies at every hop in a pipeline.
