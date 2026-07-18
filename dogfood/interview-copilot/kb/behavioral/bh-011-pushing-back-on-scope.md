---
id: bh-011
question: "Tell me about a time you pushed back on scope."
category: behavioral
difficulty: medium
expertise: mid
tags: [scope, pushback, product, planning]
---

Midway through a sprint focused on improving our order-confirmation flow, our product manager asked if we could also add subscription billing support to the same release, since a sales deal was hinging on it. On paper it sounded like a small addition, but subscription billing touches recurring payment authorization, proration, and dunning logic, none of which existed yet in our system. I told him directly that I didn't think it was small, and rather than just refusing, I spent an hour breaking down what "subscription billing" would actually require versus what the sales deal minimally needed, which turned out to be just the ability to charge a fixed amount on a schedule, not the full proration and plan-change machinery. We agreed to ship that narrow slice within the existing sprint and treat full subscription management as its own project with proper scoping the following quarter. The sales deal closed on the narrower feature, and we avoided shipping a rushed, under-tested billing system. Pushing back effectively meant not saying no to the goal, but saying no to the assumption about how big the real ask was.
