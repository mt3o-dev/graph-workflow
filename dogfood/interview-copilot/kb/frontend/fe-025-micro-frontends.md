---
id: fe-025
question: "What are micro-frontends, and what tradeoffs come with splitting a SPA into them?"
category: frontend
difficulty: hard
expertise: senior
tags: [micro-frontends, architecture, tradeoffs]
---

Micro-frontends split a large frontend into independently deployable pieces, often owned by different teams, that get composed together at runtime or build time into one application — similar in spirit to microservices but for the UI layer. The appeal is real for large organizations: teams can ship on their own schedule, use different tech stacks or versions if truly necessary, and scale ownership boundaries that map to team boundaries instead of everyone contending over one monolithic frontend repo and release train. The costs are also real and often underestimated: shared design consistency gets harder to enforce, you're often shipping duplicate framework runtimes unless you're disciplined about shared dependencies, cross-fragment state and navigation need deliberate contracts, and the operational complexity — build pipelines, versioning, integration testing across fragments — goes up significantly. I'd only reach for micro-frontends when the organizational problem is real, multiple autonomous teams genuinely blocked by a shared codebase, not as a default architecture. For most products, a well-organized monolith with good internal module boundaries gets you most of the benefits without the runtime composition overhead.
