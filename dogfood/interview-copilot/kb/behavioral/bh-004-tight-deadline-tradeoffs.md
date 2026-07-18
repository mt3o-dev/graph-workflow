---
id: bh-004
question: "Tell me about a time you had to make tradeoffs to meet a tight deadline."
category: behavioral
difficulty: medium
expertise: mid
tags: [deadlines, tradeoffs, prioritization, scope]
---

Ahead of our Black Friday freeze, we discovered our new saved-payment-methods feature wasn't going to be fully ready, and the freeze date was non-negotiable since it protected the whole platform during peak load. Rather than push the deadline or ship something half-tested, I sat down with the PM and broke the feature into what customers actually needed versus what was nice to have. We decided the core flow, saving and reusing a card at checkout, had to be rock solid, while editing saved cards and setting a default payment method could wait until after the freeze. I put the edit and default-setting UI behind a feature flag so the code could merge safely without being exposed. That let us focus our remaining testing time entirely on the checkout path, which is the part real money flows through. We shipped on time with zero payment incidents over the holiday period, and rolled out the secondary features two weeks later once we had bandwidth to test them properly. The lesson I carry forward is that tight deadlines are really scope decisions in disguise.
