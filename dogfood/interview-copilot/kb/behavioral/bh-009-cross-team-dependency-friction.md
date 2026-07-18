---
id: bh-009
question: "Tell me about a time you dealt with friction from a cross-team dependency."
category: behavioral
difficulty: medium
expertise: mid
tags: [cross-team, dependencies, collaboration, api]
---

Our checkout redesign depended on the platform team exposing a new inventory-reservation API, but their roadmap had it scheduled two months after our launch date, and their backlog was managed independently with different priorities. Escalating through managers felt slow and adversarial, so I first tried to understand why it was deprioritized on their side, and it turned out they didn't realize how many downstream teams were blocked on it, since requests had come in piecemeal from different people. I put together a one-page doc listing every team and feature waiting on that API, shared it in their team channel, and asked their tech lead if we could pair for half a day to scope a minimal version that unblocked us without requiring their full planned feature set. We ended up building a narrower version together that took them three days instead of three weeks, with the fuller version following later. The friction wasn't really about competing priorities, it was about visibility, and making the total blocked impact concrete turned a standoff into a joint problem worth solving quickly.
