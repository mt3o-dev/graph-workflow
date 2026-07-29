// Rich content pipeline for card text fields (slice 7): Markdown + KaTeX math
// + syntax-highlighted code blocks, sanitized twice — once at write time,
// once at render time. See docs/architecture.md's hexagonal boundary note:
// this file imports plain npm libraries (marked/katex/shiki/sanitize-html),
// never astro:*/adapters/**/pages/**, so it stays inside the domain layer.
//
// ---------------------------------------------------------------------------
// WHY TWO SANITIZATION LAYERS (defense in depth, not redundant belt-and-braces)
// ---------------------------------------------------------------------------
// Layer 1 — sanitizeRichTextSource(): runs at WRITE time, on the raw markdown
//   SOURCE the student typed, before it is ever persisted. It strips any raw
//   HTML tags smuggled into the markdown (`<script>`, `<img onerror=...>`,
//   a literal `<a href="javascript:...">`). Markdown syntax itself
//   (**bold**, [text](url), $x$, ```code```, {{c1::cloze}}) contains no HTML
//   tags, so legitimate content passes through untouched.
// Layer 2 — sanitizeRenderedHtml() (used inside renderRichText()): runs at
//   RENDER time, on the HTML the markdown/KaTeX/Shiki pipeline just produced,
//   every single time a card is displayed. It allowlists exactly the tags/
//   attributes that pipeline can legitimately emit and nothing else.
// These are deliberately independent: layer 1 sanitizes raw text with an
// empty-tag allowlist, layer 2 sanitizes generated HTML with a rich
// allowlist. A bug in the markdown parser, the KaTeX renderer, or the syntax
// highlighter (all three are third-party code) would still have to get past
// layer 2 before reaching a browser. A bug in layer 2's allowlist on a card
// that somehow skipped layer 1 (e.g. content written before this slice
// existed, or a future write path that forgets to call layer 1) would still
// have been stripped by layer 1 if it *had* run. Neither layer alone is
// assumed sufficient; skipping either because "the other one already handles
// it" is exactly the failure mode this comment exists to prevent.
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import markedShiki from "marked-shiki";
import { codeToHtml } from "shiki";
import sanitizeHtml from "sanitize-html";
import type { CardPayload, CardType } from "./types";

// ---------------------------------------------------------------------------
// Layer 1: write-time sanitization of raw markdown source.
// ---------------------------------------------------------------------------

/**
 * Strips any raw HTML the user tried to embed in markdown source (script
 * tags, event-handler attributes, javascript: hrefs written as literal
 * `<a href=...>` instead of markdown link syntax) before the text is ever
 * stored. Ordinary markdown/KaTeX/cloze syntax contains no HTML tags and is
 * left completely intact.
 */
export function sanitizeRichTextSource(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

/** Applies sanitizeRichTextSource to every rich-text-bearing field of a card payload, by type. */
export function sanitizeCardPayload(type: CardType, payload: CardPayload): CardPayload {
  const p = payload as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === "string" ? sanitizeRichTextSource(v) : (v as string));
  switch (type) {
    case "basic":
      return { ...p, front: s(p.front), back: s(p.back) } as CardPayload;
    case "cloze":
      return { ...p, text: s(p.text) } as CardPayload;
    case "multiple_choice":
      return {
        ...p,
        question: s(p.question),
        options: Array.isArray(p.options) ? p.options.map(s) : p.options,
      } as CardPayload;
    case "true_false":
      return { ...p, statement: s(p.statement) } as CardPayload;
    case "type_answer":
      return {
        ...p,
        prompt: s(p.prompt),
        acceptedAnswers: Array.isArray(p.acceptedAnswers) ? p.acceptedAnswers.map(s) : p.acceptedAnswers,
      } as CardPayload;
    case "image_occlusion":
      return {
        ...p,
        regions: Array.isArray(p.regions)
          ? (p.regions as Array<Record<string, unknown>>).map((r) => ({ ...r, label: s(r.label) }))
          : p.regions,
        // imageUrl is a stored-upload URL, not rendered rich text — left untouched.
      } as CardPayload;
    default:
      return payload;
  }
}

// ---------------------------------------------------------------------------
// Layer 2: render-time sanitization + the markdown/KaTeX/Shiki pipeline.
// ---------------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const CSS_LENGTH = /^-?[0-9]*\.?[0-9]+(em|px|ex|%)?$/;

const RENDER_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "del",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "code",
    "pre",
    "span",
    "div",
    // h1/h2 intentionally excluded — those belong to page chrome (set/page
    // titles), not card body text; h3-h6 are "sensible for flashcard
    // context" per the slice spec, h1/h2 are not.
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // No event-handler attributes (on*) are ever allowlisted here, so an
    // <img onerror=...> that somehow reached layer 2 would just lose the
    // onerror attribute and render as a normal, inert image request.
    img: ["src", "alt", "title", "width", "height"],
    span: ["class", "style", "aria-hidden", "aria-label"],
    div: ["class", "style", "aria-hidden"],
    pre: ["class", "style", "tabindex"],
    code: ["class"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
  // KaTeX's html-output mode and Shiki's syntax highlighting both rely on
  // inline `style` for layout/color — allowlisted per-property below (not
  // left wide-open) so a `style="background:url(...)"` exfil/CSS-injection
  // attempt can't ride along even though `style` itself is permitted.
  allowedStyles: {
    "*": {
      color: [HEX_COLOR],
      "background-color": [HEX_COLOR],
      "--shiki-dark": [HEX_COLOR],
      "--shiki-dark-bg": [HEX_COLOR],
      "--shiki-light": [HEX_COLOR],
      "--shiki-light-bg": [HEX_COLOR],
      height: [CSS_LENGTH],
      width: [CSS_LENGTH],
      "min-width": [CSS_LENGTH],
      top: [CSS_LENGTH],
      bottom: [CSS_LENGTH],
      left: [CSS_LENGTH],
      right: [CSS_LENGTH],
      "margin-left": [CSS_LENGTH],
      "margin-right": [CSS_LENGTH],
      "margin-top": [CSS_LENGTH],
      "margin-bottom": [CSS_LENGTH],
      "border-bottom-width": [CSS_LENGTH],
      "vertical-align": [CSS_LENGTH],
      position: [/^(relative|static|absolute)$/],
    },
  },
  transformTags: {
    // Any link that survives sanitization opens in a new tab without giving
    // the linked page a handle back to ours (noopener) or leaking referrer
    // (noreferrer) — standard hardening for user-supplied links.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true),
  },
};

/** Sanitizes already-rendered HTML through the render-time allowlist (Layer 2, see file header). */
export function sanitizeRenderedHtml(html: string): string {
  return sanitizeHtml(html, RENDER_SANITIZE_OPTIONS);
}

function escapeForFallbackCode(code: string): string {
  return code
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// A dedicated Marked instance (not the module-level default) so this
// pipeline's extensions never leak into / get overridden by another part of
// the app that might also use `marked` in the future.
const markedInstance = new Marked();
markedInstance.use(
  markedKatex({
    throwOnError: false,
    // KaTeX's "html" output mode emits pure HTML+CSS (span layout tricks),
    // no MathML and — critically — no client-side JS is needed to *display*
    // already-rendered KaTeX HTML. This is what keeps math rendering fully
    // server-side per the slice spec ("don't ship the full client-side
    // KaTeX JS bundle just to render static flashcard content").
    output: "html",
  }),
);
markedInstance.use(
  markedShiki({
    async highlight(code, lang) {
      try {
        return await codeToHtml(code, {
          lang: lang || "text",
          // Dual light/dark theme output (CSS custom properties + a small
          // prefers-color-scheme override in global.css) rather than a
          // single baked-in theme, matching the rest of the app's
          // light/dark support.
          themes: { light: "github-light", dark: "github-dark" },
        });
      } catch {
        // Unknown/unsupported language tag: fall back to a plain, still-safe
        // code block instead of failing the whole card render.
        return `<pre><code>${escapeForFallbackCode(code)}</code></pre>`;
      }
    },
  }),
);

/**
 * Full render-time pipeline: markdown -> (KaTeX math, Shiki-highlighted code)
 * -> HTML -> sanitize (Layer 2). Safe to call on legacy plain-text card
 * content with no markdown syntax at all — it just renders as a plain
 * paragraph, visually equivalent to the old escaped-text output (see
 * .rich-content CSS resetting paragraph margins to avoid a visual bump).
 */
export async function renderRichText(raw: string): Promise<string> {
  const html = await markedInstance.parse(raw, { async: true });
  return sanitizeRenderedHtml(html);
}

/**
 * Same pipeline as renderRichText but without the block-level `<p>` wrapper
 * (marked's `parseInline`) — for text spliced into the middle of another
 * sentence (e.g. "the correct answer was: {answer}"), where a nested block
 * element would be invalid/visually odd. Still goes through KaTeX/Shiki/
 * sanitize exactly the same way; only the outer wrapping differs.
 */
export async function renderRichTextInline(raw: string): Promise<string> {
  const html = await markedInstance.parseInline(raw, { async: true });
  return sanitizeRenderedHtml(html);
}
