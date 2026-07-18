---
id: bh-008
question: "Tell me about a time you had to prioritize under ambiguity."
category: behavioral
difficulty: hard
expertise: senior
tags: [ambiguity, prioritization, fraud, stakeholders]
---

We were asked to build fraud detection for checkout, but the request came from three directions at once: risk wanted velocity checks on card usage, support wanted a manual review queue, and the fraud vendor's API had capabilities nobody had fully mapped against our needs. There was no single owner and no clear spec, just a shared sense that fraud losses were rising. Rather than waiting for someone above me to resolve the ambiguity, I set up a short working session with a representative from each group and asked everyone the same question: what does a fraud incident cost us today if we do nothing for one more quarter. That reframed the conversation around impact instead of feature wishlists, and it became clear velocity checks would catch the most volume for the least engineering effort, so I proposed we ship that first as a two-week increment, instrument it, and use real data to decide whether the review queue was even necessary. It turned out velocity checks alone cut fraud losses by sixty percent, and the review queue became a much smaller, better-scoped follow-up. In ambiguous situations, I've learned that proposing a cheap, measurable first step unlocks more clarity than any amount of upfront debate.
