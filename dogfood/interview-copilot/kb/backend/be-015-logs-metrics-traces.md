---
id: be-015
question: "What's the difference between logs, metrics, and traces in observability?"
category: backend
difficulty: easy
expertise: junior
tags: [observability, monitoring, opentelemetry]
---

Logs, metrics, and traces are the three complementary pillars of observability, and each answers a different question. Logs are discrete, timestamped events with rich context — useful for answering "what exactly happened" during a specific incident, but expensive to store and search at scale if unstructured, so I always emit structured JSON logs with a request or trace ID attached. Metrics are numeric aggregates over time, like request rate, error rate, and latency percentiles — cheap to store, great for dashboards and alerting, but they tell you something is wrong, not why. Traces follow a single request as it moves across services, showing the timing of each hop and where latency accumulated, which is essential in a microservices architecture where a slow endpoint might actually be a slow downstream call three services away. The real power comes from correlating them: an alert fires on a metric anomaly, I pivot to traces to find the slow or failing span, then pivot to logs for that specific trace ID to see the exact error. I standardize on OpenTelemetry for instrumentation so logs, metrics, and traces share context and vendor lock-in stays low.
