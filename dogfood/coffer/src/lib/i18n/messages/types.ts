/**
 * Shared value/param shapes for the typed message catalog (P2, plan
 * coffer-ui-i18n [node:a0330a47]). A catalog entry is either a plain string
 * or a function of a small param bag returning a string — the function form
 * is how interpolation ("Hail, {name}!") stays type-checked instead of going
 * through untyped `%s`-style templating.
 *
 * `en.ts` is the SHAPE OF TRUTH: every entry's exact type (string, or a
 * specific `(params: X) => string` signature) flows from there into
 * `MessageKey` (keys.ts) and the `Catalog` type `pl.ts` must satisfy — a
 * missing key, or a param-shape mismatch, is a typecheck failure by
 * construction, never a runtime surprise.
 */

/** A single interpolation param value — kept to primitives the Intl
 * formatters in `format.ts` already know how to render inline. */
export type MessageParamValue = string | number;

/** A generic param bag; individual catalog entries narrow this per-key via
 * their own function signature (see `types.ts` doc above). */
export type MessageParams = Record<string, MessageParamValue>;

/** The value shape every catalog entry must satisfy. */
export type MessageValue = string | ((params: never) => string);
