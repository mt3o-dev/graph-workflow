---
id: be-002
question: "What does it mean for an HTTP method to be idempotent, and which methods are?"
category: backend
difficulty: easy
expertise: junior
tags: [http, api-design, reliability]
---

An HTTP method is idempotent if making the same request multiple times produces the same server state as making it once — repeating it doesn't cause additional side effects beyond the first call. GET, PUT, DELETE, HEAD, and OPTIONS are idempotent; POST and PATCH generally are not. GET is also safe, meaning it shouldn't change state at all. This matters a lot for reliability: if a client times out waiting for a response, it can safely retry an idempotent request without worrying about double-charging a customer or creating duplicate records, whereas retrying a non-idempotent POST could create two orders. Because POST is so common for "create" operations, I often make it idempotent in practice by having clients send an idempotency key — a unique token per logical operation — that the server stores and uses to detect and short-circuit duplicate submissions, returning the original result instead of reprocessing. This pattern is standard for payment APIs like Stripe and is worth building into any endpoint that isn't naturally idempotent but needs safe retries.
