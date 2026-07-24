/**
 * `MessageKey` — the union of every catalog key, derived from `en.ts` (the
 * shape of truth, see that file's doc). `pl.ts`'s `Catalog` type requires a
 * value for every member of this union with the exact type `en` declares
 * for that key — add a key to `en` and forget `pl`, and `pnpm typecheck`
 * fails before `pnpm test` ever runs ([node:a0330a47]).
 */
import { en } from './messages/en.js';

export type MessageKey = keyof typeof en;

/** The catalog shape every locale (including `en` itself) must satisfy. */
export type Catalog = { [K in MessageKey]: (typeof en)[K] };
