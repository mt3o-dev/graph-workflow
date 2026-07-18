---
id: be-016
question: "How do you perform a zero-downtime deployment with a database migration?"
category: backend
difficulty: hard
expertise: senior
tags: [deployment, database-migrations, reliability]
---

Zero-downtime deployment means users never see errors or downtime while new code rolls out, which I achieve with rolling or blue-green deployments behind a load balancer: new instances come up and pass health checks before traffic shifts to them, and old instances drain in-flight requests before shutting down. The harder part is database migrations, because for a window during rollout, old and new code run simultaneously against the same schema. My rule is to make every migration backward-compatible with the previous version of the code, which usually means splitting a risky change into multiple deploys: to rename a column, first add the new column and dual-write to both, backfill the new column, deploy code that reads from the new column while still writing both, then in a later deploy stop writing the old column, and only drop it once nothing depends on it. I avoid migrations that lock large tables for long periods — using tools like pg_online_schema_change or gh-ost for MySQL, or Postgres's ability to add nullable columns without a full table rewrite — and always make migrations reversible so I can roll back code without being stuck on an incompatible schema.
