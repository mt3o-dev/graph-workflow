---
id: bh-001
question: "Tell me about a time you had a conflict with a colleague."
category: behavioral
difficulty: medium
expertise: mid
tags: [conflict, communication, collaboration, payments]
---

On our checkout team, a peer and I disagreed sharply about how to design a new refund API. He wanted a single generic endpoint that handled every refund type through flags; I thought that would become an unmaintainable branching mess as we added partial refunds, gift-card reversals, and chargebacks. Instead of arguing in Slack, I asked him to grab twenty minutes so we could each sketch our approach on a whiteboard and walk through concrete future scenarios rather than abstract preferences. Seeing his design fail on a partial-refund-plus-loyalty-points case made the tradeoff obvious to both of us, and seeing mine solved cleanly earned his buy-in. We ended up merging ideas: separate endpoints per refund type sharing a common validation core, which was actually better than either original proposal. What stuck with me is that the conflict wasn't really about egos, it was about not having shared examples to reason against. Since then, whenever I hit friction with a colleague, I try to ground the disagreement in specific test cases before debating architecture in the abstract.
