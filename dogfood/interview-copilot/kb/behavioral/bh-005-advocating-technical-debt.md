---
id: bh-005
question: "Tell me about a time you advocated for paying down technical debt."
category: behavioral
difficulty: medium
expertise: senior
tags: [technical-debt, advocacy, architecture, payments]
---

Our payment gateway integration had grown organically over three years into a tangle of provider-specific conditionals scattered across a dozen files, and every new gateway we added took roughly twice as long as the last one, plus introduced regressions in existing ones. Leadership was focused on feature velocity, so "refactor the gateway layer" was a hard sell on its own. Instead of framing it as cleanup, I quantified it: I tracked the last four gateway integrations and showed the average time had gone from three weeks to six, and that two of our last three production payment incidents traced back to that shared conditional logic. I proposed a two-week spike to build a proper adapter interface, scoped narrowly so it wouldn't stall the roadmap, and offered to do it alongside my regular feature work rather than asking for a dedicated sprint. Leadership approved it once they saw the incident correlation. After the refactor, our next gateway integration took eight days, and we haven't had a cross-gateway regression since. Framing debt in terms of velocity and incidents, not code aesthetics, is what got buy-in.
