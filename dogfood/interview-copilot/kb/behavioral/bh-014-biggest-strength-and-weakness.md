---
id: bh-014
question: "What is your biggest strength and biggest weakness?"
category: behavioral
difficulty: easy
expertise: mid
tags: [self-awareness, strengths, weaknesses, honesty]
---

My biggest strength is pragmatic debugging under pressure, I'm the person people pull into an incident because I stay calm, form a hypothesis, and test it with the smallest possible experiment rather than guessing broadly, which comes from years of chasing intermittent bugs in a payments system where you can't just restart your way out of a problem. My biggest weakness, which I've been actively working on, is a tendency to over-engineer solutions when I have time and no external pressure forcing simplicity. Early on I built a plugin-based validation framework for a feature that only ever needed three validation rules, and it added complexity nobody used for two years before someone finally simplified it. Since then I've adopted a personal rule: I don't add an abstraction until I have at least two concrete cases that need it, not a hypothetical third one I'm imagining. I also started asking a teammate to review my designs specifically for unnecessary flexibility before I write code, which has caught this pattern in me twice in the last year. It's a weakness I don't think I'll ever fully eliminate, but I've gotten much better at catching it early.
