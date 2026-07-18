---
id: bh-019
question: "Tell me about a time you dealt with a customer-impacting bug."
category: behavioral
difficulty: medium
expertise: mid
tags: [bug, customer-impact, payments, communication]
---

We got an alert from support that a small number of customers had been double-charged during checkout, which in a payments product is about as serious as a bug gets. I dropped what I was doing and traced it to our retry logic: when a payment gateway response timed out, our client retried the charge, but the original request had actually succeeded on the gateway's side just slowly, so the retry created a genuine second charge instead of hitting an idempotency check that we'd assumed the gateway enforced but didn't for that specific endpoint. I fixed the immediate issue by adding our own idempotency key generation and a lookup before retrying, and then queried our transaction logs to find every affected customer over the incident window rather than waiting for more complaints to trickle in. I worked with support to proactively refund every duplicate charge before those customers even noticed or complained, and we sent a short, honest explanation rather than a vague apology. Being proactive rather than reactive turned what could have been a trust-damaging incident into something several customers actually thanked us for. I now treat "does the gateway guarantee idempotency" as a mandatory question in every payment integration review.
