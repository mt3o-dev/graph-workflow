// Validated environment access. Import this BEFORE anything else touches
// process.env — it resolves + validates against .env.schema (see docs/ADR-varlock.md)
// and throws immediately if the environment is invalid, instead of failing later
// with a confusing runtime error deep in a db/auth adapter.
import { ENV, initVarlockEnv } from "varlock/env";

// Side effect: resolves + validates env against .env.schema. In dev/test this
// process is normally launched via `varlock run -- ...` (see package.json
// scripts), which is required for this to succeed — see docs/ADR-varlock.md.
initVarlockEnv();

export { ENV };
