---
id: bh-007
question: "Tell me about a time you received harsh feedback."
category: behavioral
difficulty: medium
expertise: mid
tags: [feedback, growth-mindset, code-review, humility]
---

A staff engineer reviewed a service I'd designed for handling subscription billing retries and called the state machine "overcomplicated and hard to reason about" in a fairly blunt comment thread, which stung because I'd spent real effort on it. My first instinct was to get defensive and explain all the edge cases that justified the complexity, but I made myself wait a day before responding. When I came back to it with a clearer head, I realized he was right about the core issue even if his delivery was harsh: I'd conflated three separate concerns, payment retry, dunning notifications, and subscription status, into one state machine because they were related, not because they belonged together. I rewrote it as three smaller, single-purpose state machines that composed cleanly, and it ended up easier to test and extend. I also told him directly that the technical point landed but the framing made it harder to hear, which he took well and we've had a good working relationship since. I try to separate the validity of feedback from how it's delivered, because the two aren't correlated.
