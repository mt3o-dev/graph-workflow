---
id: be-023
question: "How do you version a public API without breaking existing clients?"
category: backend
difficulty: easy
expertise: junior
tags: [api-design, versioning, backward-compatibility]
---

I version APIs to let me evolve the contract without breaking clients that are already integrated against an older version. The most common approach is a version in the URL path, like /v1/orders and /v2/orders, which is simple, visible, and easy to route at the gateway or load-balancer level, though it does mean the URL isn't a stable identifier for a resource across versions. An alternative is a version in a header, like an Accept header with a media type, which keeps URLs stable but is less discoverable and harder to test by just clicking a link. Whichever mechanism I pick, the more important discipline is deciding what counts as a breaking change: adding a new optional field is non-breaking and doesn't need a version bump, but removing a field, renaming one, or changing a field's type or semantics is breaking. I aim to make additive changes without versioning at all, reserve a new major version for genuine breaking changes, and support at least the previous version for a clearly communicated deprecation window with usage monitoring, so I know when it's actually safe to sunset it.
