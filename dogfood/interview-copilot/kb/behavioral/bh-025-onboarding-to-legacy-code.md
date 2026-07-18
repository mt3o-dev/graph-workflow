---
id: bh-025
question: "Tell me about a time you had to onboard onto a legacy codebase."
category: behavioral
difficulty: easy
expertise: mid
tags: [legacy-code, onboarding, documentation, monolith]
---

When I joined my current team, I inherited ownership of a large monolithic order-processing service, internally nicknamed Atlas, that had been built by engineers who'd since left the company, with almost no documentation and inconsistent naming conventions that made it hard to tell what half the modules actually did. Rather than trying to read the entire codebase linearly, which I knew from experience doesn't stick, I picked a real, small bug ticket in my first week and used it as a forcing function to trace one path through the system end to end, from the API entry point down through the database writes, documenting what I learned as I went. That gave me a concrete mental model faster than passive reading would have, and I kept a running glossary of terms and modules whose purpose wasn't obvious from their names, which I later turned into a short onboarding doc for the next new hire. I also made a habit of asking the two most senior engineers on the team specific, narrow questions, like why a particular validation step existed, rather than vague "can you explain this codebase" requests, since specific questions got specific, useful answers instead of overwhelming context dumps. Within about a month I felt confident making non-trivial changes to Atlas, and the onboarding doc I wrote is still used by new hires today.
