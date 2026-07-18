---
id: be-007
question: "Why do we use database connection pooling, and how do you size a pool?"
category: backend
difficulty: medium
expertise: mid
tags: [database, connection-pooling, performance]
---

Opening a new database connection is expensive — it involves a TCP handshake, authentication, and on the Postgres side, forking a new backend process — so doing that per request would tank throughput and exhaust the database's max connection limit under load. A connection pool keeps a set of already-established connections open and hands them out to application threads or requests as needed, returning them to the pool when done instead of closing them. Sizing the pool is a balance: too small and requests queue waiting for a free connection; too large and you risk overwhelming the database, since each connection consumes memory and, for Postgres, a whole backend process. A common starting formula is roughly connections = (core_count * 2) + effective_spindle_count per application instance, then load-test and tune from there, multiplying by however many app instances run against the same database. I also watch out for pool exhaustion from long-running or leaked connections, and in cloud environments I often put a pooler like PgBouncer in front of Postgres to multiplex many app connections onto fewer real database connections.
