---
id: bh-015
question: "Tell me about a time you influenced a decision without having authority."
category: behavioral
difficulty: hard
expertise: senior
tags: [influence, leadership, cross-team, standards]
---

I noticed that three separate teams had each built their own version of payment-retry logic with subtly different backoff strategies and error handling, and two of them had already caused minor incidents from retrying non-retryable errors like invalid card numbers. I had no authority over those teams, I was a senior engineer on a fourth team entirely, so I couldn't mandate anything. Instead, I built a small shared library implementing retry logic with sane defaults, tested it thoroughly against our real error taxonomy, and wrote up the two incidents it would have prevented in a doc I shared broadly rather than pitching it in a meeting first. I then asked each team's tech lead individually for feedback on the API design before asking anyone to adopt it, which turned them into co-designers rather than recipients of a mandate. Two teams adopted it within a month once they saw it fit their needs and referenced the incident history. The third took longer but eventually migrated after their own near-incident. Influence without authority, for me, comes down to making the safer path the easiest path, and involving people in shaping it rather than presenting a finished decision.
