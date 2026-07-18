---
id: be-005
question: "How do database indexes work, and how do you read a query execution plan?"
category: backend
difficulty: easy
expertise: junior
tags: [database, indexing, performance]
---

An index is a separate data structure, usually a B-tree, that lets the database find rows matching a condition without scanning the whole table — trading extra write cost and storage for much faster reads on the indexed columns. I index columns used in WHERE clauses, JOIN conditions, and ORDER BY, and I think about composite indexes where column order matters: an index on (a, b) helps queries filtering on a alone or a and b, but not b alone. To verify an index is actually helping, I run EXPLAIN, or EXPLAIN ANALYZE in Postgres, on the query and read the plan bottom-up: I'm looking for a sequential scan on a large table where I expected an index scan, estimated versus actual row counts diverging wildly, which signals stale statistics, and expensive operations like sorts or nested loops over large row sets. A plan that looks fine at low data volume can degrade badly at production scale, so I always test against realistic data sizes and re-check plans after schema or data-distribution changes, not just once at design time.
