---
id: bh-006
question: "Tell me about a time you mentored a junior engineer."
category: behavioral
difficulty: easy
expertise: mid
tags: [mentoring, growth, debugging, collaboration]
---

When a junior engineer joined our order-management team, she was struggling with an intermittent bug in our async job processor where webhook retries occasionally arrived out of order. She'd been stuck for two days trying to fix it by reading the code top to bottom, which is a natural instinct but rarely works for timing bugs. Instead of handing her the answer, I sat with her and taught her to add structured logging around every state transition and then reproduce the issue under load locally rather than staring at production logs. Within an hour of instrumenting it properly, she spotted the race condition herself, two workers picking up the same webhook because our lock had a gap between check and acquire. I made a point of having her present the fix and the root cause to the team in our next sync, since owning the explanation solidifies the learning more than just merging the fix quietly. She's since become the person other juniors go to for debugging help. What I try to model in mentoring is teaching the diagnostic process, not just supplying answers.
