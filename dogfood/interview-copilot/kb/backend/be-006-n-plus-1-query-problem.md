---
id: be-006
question: "What is the N+1 query problem and how do you fix it?"
category: backend
difficulty: easy
expertise: junior
tags: [database, performance, orm]
---

The N+1 problem happens when code fetches a list of N parent records with one query, then loops over them issuing a separate query per record to fetch related data — so you end up with 1 + N queries instead of a small constant number. It's extremely common with ORMs that lazy-load associations by default: fetching 100 orders and then accessing order.customer inside a loop silently fires 100 additional queries. The fix is to eagerly load the association upfront, using something like a JOIN, an ORM's "include" or "with" clause, or a DataLoader-style batching layer in GraphQL resolvers that collects all the IDs needed in a tick and issues one batched query. I catch this in code review by looking for association access inside loops, and in production by watching per-request query counts in APM tooling — a request that suddenly issues hundreds of near-identical queries is almost always N+1. It's one of the most common and most damaging performance bugs because it works fine in dev with small datasets and only bites under real load.
