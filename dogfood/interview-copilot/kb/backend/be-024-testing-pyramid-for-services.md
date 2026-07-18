---
id: be-024
question: "How do you structure the testing pyramid for a backend service?"
category: backend
difficulty: medium
expertise: mid
tags: [testing, quality, ci-cd]
---

I structure backend service tests as a pyramid: a large base of fast unit tests, a smaller layer of integration tests, and a thin top layer of end-to-end tests, because the cost and flakiness of a test generally scales with how many real dependencies it touches. Unit tests exercise business logic in isolation, with dependencies like the database or external APIs mocked or faked, so they run in milliseconds and give fast, precise feedback on logic bugs. Integration tests verify that a service correctly talks to its real dependencies — hitting an actual test database, or a real message queue in a container via something like Testcontainers — catching issues unit tests can't, like a wrong SQL query or a serialization mismatch, at the cost of being slower and needing more setup. End-to-end tests exercise a full user-facing flow across multiple services, giving the highest confidence that the system works as a whole, but they're slow, brittle, and expensive to maintain, so I keep only a handful covering the most critical paths, like checkout or login. I also add contract tests between services communicating asynchronously or via APIs, since that's often where the pyramid alone misses breakage.
