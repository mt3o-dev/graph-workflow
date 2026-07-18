---
id: be-025
question: "How do you implement graceful shutdown for a backend service?"
category: backend
difficulty: easy
expertise: junior
tags: [reliability, deployment, kubernetes]
---

Graceful shutdown means a service, when told to stop — by SIGTERM from an orchestrator like Kubernetes during a deploy or scale-down — finishes its current work cleanly instead of dropping in-flight requests or leaving data half-written. The pattern I implement is: first, stop accepting new work by failing readiness checks so the load balancer stops routing new traffic, and close the listening socket to new connections; second, let in-flight requests finish within a bounded grace period; third, close resources cleanly in order — flush any buffered logs or metrics, finish in-progress database transactions, stop background workers or consumers after they finish their current message, and close connection pools; and finally exit. I always set the grace period shorter than the orchestrator's forced-kill timeout, so the process gets a real chance to finish before Kubernetes sends SIGKILL, and I make sure the process actually listens for SIGTERM rather than ignoring it, which is a surprisingly common bug in containerized apps where a shell wrapper eats the signal instead of forwarding it to the actual process. For queue consumers specifically, I make sure a message being processed when shutdown starts either completes and acks, or is left unacked so it's safely redelivered rather than lost.
