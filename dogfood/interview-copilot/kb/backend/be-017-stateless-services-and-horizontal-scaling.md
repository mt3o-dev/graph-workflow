---
id: be-017
question: "What does it mean for a service to be stateless, and why does it matter for scaling?"
category: backend
difficulty: easy
expertise: junior
tags: [scalability, architecture, statelessness]
---

A stateless service doesn't keep any client-specific data in its own process memory or local disk between requests — anything that needs to persist, like session data, uploaded files, or in-progress computation, lives in an external store like Redis, a database, or object storage instead. This matters enormously for scaling because it means any instance can handle any request: a load balancer can route to whichever instance is least busy, you can add or remove instances freely based on load, and if one instance crashes, its in-flight requests can simply be retried against another instance without losing anything permanent. If a service holds state in memory, like sticky sessions or an in-process cache that's the source of truth, you lose that flexibility — you need session affinity, scaling becomes harder because new instances start "cold," and an instance crash actually loses data. I design services to be stateless by default and only introduce local state as a performance optimization, like an in-process cache, where it's explicitly safe because the external store remains the source of truth and the local copy can be invalidated or simply expire.
