---
id: bh-020
question: "Tell me about a time you disagreed with a colleague during a code review."
category: behavioral
difficulty: easy
expertise: mid
tags: [code-review, disagreement, sql, orm]
---

A colleague submitted a pull request for a new reporting query using our ORM's query builder, chaining together nested joins and filters, and I left a comment suggesting we drop to raw SQL for that specific query since the generated SQL looked inefficient and hard to reason about for a report that would run against millions of transaction rows. He pushed back, reasonably, saying raw SQL breaks our ORM's migration tooling and creates a maintenance burden if the schema changes. Rather than going back and forth in review comments, I asked if we could just run both versions against a production-sized snapshot and compare execution plans, since we were arguing about a performance assumption neither of us had actually verified. The raw SQL version turned out to run in about four hundred milliseconds versus his version's six seconds, which settled the debate empirically instead of on style preference. We compromised by keeping it as raw SQL but wrapping it in a well-documented repository method so it stayed isolated and easy to find if the schema ever changed. I've found that code review disagreements go faster when you can replace "I think" with a quick measurable test.
