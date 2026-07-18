---
id: be-013
question: "How would you implement rate limiting for a public API?"
category: backend
difficulty: easy
expertise: junior
tags: [api-design, rate-limiting, reliability]
---

For a public API, I usually implement rate limiting with a token bucket or sliding-window counter, keyed by API key or client IP, backed by Redis so it works consistently across multiple stateless API instances. Token bucket is my default because it allows short bursts while still enforcing a steady average rate, which matches how real clients behave better than a hard fixed window that has edge-of-window burst problems. I return standard headers — X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After — so well-behaved clients can back off gracefully, and a 429 status code when the limit is exceeded. I also tier limits: stricter limits for anonymous or free-tier traffic, higher limits for authenticated paying customers, and separate, tighter limits on expensive endpoints like search or bulk export regardless of tier. At the infrastructure level I put a first line of defense at the load balancer or API gateway for coarse protection against abuse, and finer, business-aware limits in the application layer where I can reason about cost per request. I make sure rate limiting fails open or degrades gracefully if Redis itself is unavailable, rather than taking the whole API down.
