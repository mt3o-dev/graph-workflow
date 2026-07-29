// Slice 7 (kartka-rich-content): the security tests here are the load-bearing
// part of this slice per the spec — real XSS payloads through the full
// write -> render pipeline, asserting the sanitized output actually contains
// none of the dangerous payload (not just "doesn't throw").
import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import {
  sanitizeRichTextSource,
  sanitizeCardPayload,
  renderRichText,
  renderRichTextInline,
} from "../src/core/domain/richContent";
import { renderCardBodyRich, renderPreview, feedbackFragmentRich } from "../src/lib/richReviewFragments";
import { renderClozeHidden, renderClozeRevealed } from "../src/core/domain/cloze";
import type { BasicPayload, ClozePayload, MultipleChoicePayload, TrueFalsePayload, TypeAnswerPayload } from "../src/core/domain/types";

const dbPath = `./data/test-rich-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(dbPath);
    unlinkSync(`${dbPath}-shm`);
    unlinkSync(`${dbPath}-wal`);
  } catch {
    // best-effort cleanup, fine if wal/shm files don't exist
  }
});

// ---------------------------------------------------------------------------
// XSS payloads used throughout — real attack strings, not placeholders.
// ---------------------------------------------------------------------------
const SCRIPT_TAG = "<script>alert(1)</script>";
const IMG_ONERROR = '<img src=x onerror=alert(1)>';
const MARKDOWN_JS_LINK = "[link](javascript:alert(1))";
const RAW_HTML_JS_LINK = '<a href="javascript:alert(1)">click</a>';
const SVG_ONLOAD = '<svg onload=alert(1)>';
const DATA_URI_IMG = '<img src="data:text/html,<script>alert(1)</script>">';

describe("richContent: Layer 1 (write-time source sanitization)", () => {
  test("strips <script> tags entirely, including their content", () => {
    expect(sanitizeRichTextSource(SCRIPT_TAG)).not.toContain("<script");
    expect(sanitizeRichTextSource(SCRIPT_TAG)).not.toContain("alert(1)");
  });

  test("strips <img onerror=...> ", () => {
    const out = sanitizeRichTextSource(IMG_ONERROR);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
  });

  test("strips raw <a href=javascript:...> down to plain text", () => {
    const out = sanitizeRichTextSource(RAW_HTML_JS_LINK);
    expect(out).not.toContain("<a");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click");
  });

  test("strips <svg onload=...>", () => {
    const out = sanitizeRichTextSource(SVG_ONLOAD);
    expect(out).not.toContain("onload");
    expect(out).not.toContain("<svg");
  });

  test("strips a data: URI img smuggling a script", () => {
    const out = sanitizeRichTextSource(DATA_URI_IMG);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
  });

  test("leaves real markdown syntax completely untouched (no HTML tags to strip)", () => {
    const md = "**bold** and *italic* and [a link](https://example.com) and $x^2$ and {{c1::cloze}}";
    expect(sanitizeRichTextSource(md)).toBe(md);
  });
});

describe("richContent: Layer 2 (render-time HTML sanitization) via renderRichText", () => {
  test("a <script> tag that somehow reached render time is stripped, not executed", async () => {
    // Simulates a bug that skipped Layer 1 (e.g. legacy data, or a future
    // write path that forgets to call sanitizeCardPayload) — Layer 2 must
    // independently neutralize it.
    const out = await renderRichText(SCRIPT_TAG);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  test("markdown javascript: link loses its href entirely (scheme not allowlisted)", async () => {
    const out = await renderRichText(MARKDOWN_JS_LINK);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("link"); // the link text itself is harmless and kept
  });

  test("img is allowed at render time (real markdown images work) but onerror is stripped", async () => {
    // img is legitimately allowlisted at Layer 2 (src/alt/title/width/height
    // only, no event-handler attributes) — a plain, safe img tag is expected
    // to survive; onerror specifically must not.
    const out = await renderRichText(IMG_ONERROR);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
    expect(out.toLowerCase()).toContain("<img");
  });

  test("a data: URI img src is stripped (scheme not allowlisted for img either)", async () => {
    const out = await renderRichText(DATA_URI_IMG);
    expect(out).not.toContain("data:");
    expect(out).not.toContain("<script");
  });

  test("a real markdown image with an https URL renders as a real, safe <img>", async () => {
    const out = await renderRichText("![a diagram](https://example.com/diagram.png)");
    expect(out).toContain("<img");
    expect(out).toContain('src="https://example.com/diagram.png"');
    expect(out).toMatch(/alt="a diagram"|alt='a diagram'/);
  });

  test("no on* event handler attributes survive on any allowed tag", async () => {
    const out = await renderRichText('<p onclick="alert(1)">hi</p> and <a href="https://example.com" onmouseover="alert(1)">link</a>');
    expect(out).not.toMatch(/\son\w+\s*=/i);
  });

  test("style-based CSS injection (url exfil) is stripped, only allowlisted properties survive", async () => {
    const out = await renderRichText('<span style="background:url(https://evil.example/exfil)">x</span>');
    expect(out).not.toContain("evil.example");
  });
});

describe("richContent: legitimate rendering", () => {
  test("bold/italic/lists/links render correctly", async () => {
    const out = await renderRichText("**bold** and *italic* and a list:\n- one\n- two\n\nand [a link](https://example.com).");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<li>two</li>");
    expect(out).toContain('href="https://example.com"');
  });

  test("headings h3-h6 are allowed; h1/h2 are not part of the allowlist", async () => {
    const h3 = await renderRichText("### Heading");
    expect(h3).toContain("<h3>Heading</h3>");
    const h1 = await renderRichText("# Heading");
    // marked still emits <h1>, but sanitize-html strips it from the allowlist —
    // the text content survives, the h1 tag itself does not.
    expect(h1).not.toContain("<h1>");
    expect(h1).toContain("Heading");
  });

  test("inline and block KaTeX math render without erroring and produce katex output", async () => {
    const inline = await renderRichText("Einstein: $E=mc^2$");
    expect(inline).toContain('class="katex"');
    const block = await renderRichText("$$\\int_0^1 x\\,dx = \\frac{1}{2}$$");
    expect(block).toContain('class="katex-display"');
  });

  test("an intentionally malformed KaTeX expression does not throw (throwOnError: false)", async () => {
    await expect(renderRichText("$\\frac{1$")).resolves.toBeString();
  });

  test("fenced code blocks get syntax-highlighted (shiki output), not just <pre><code>", async () => {
    const out = await renderRichText("```js\nconst x = 1;\n```");
    expect(out).toContain("shiki");
    expect(out).toContain("<pre");
    expect(out).toContain("<span");
  });

  test("an unknown language tag falls back to a plain, still-safe code block instead of erroring", async () => {
    const out = await renderRichText("```not-a-real-language\nsome text\n```");
    expect(out).toContain("some text");
  });

  test("renderRichTextInline does not wrap output in a block-level <p>", async () => {
    const out = await renderRichTextInline("**bold**");
    expect(out).not.toContain("<p>");
    expect(out).toContain("<strong>bold</strong>");
  });
});

describe("richContent: legacy plain-text content is visually unaffected", () => {
  test("plain text with no markdown syntax renders as an equivalent plain paragraph", async () => {
    const plain = "Plain legacy text with no markdown at all.";
    const out = await renderRichText(plain);
    expect(out.trim()).toBe(`<p>${plain}</p>`);
  });

  test("plain text containing literal special characters is still escaped, not misinterpreted", async () => {
    const plain = "2 < 3 and 5 > 4";
    const out = await renderRichText(plain);
    expect(out).toContain("2 &lt; 3 and 5 &gt; 4");
  });
});

describe("richContent: cloze + markdown coexistence", () => {
  const text = "The [Eiffel Tower](https://en.wikipedia.org/wiki/Eiffel_Tower) is in **{{c1::Paris}}**, and $\\pi \\approx 3.14$.";

  test("hidden side: cloze deletion is blanked, markdown link/bold/math still render", async () => {
    const out = await renderRichText(renderClozeHidden(text));
    expect(out).toContain("[...]");
    expect(out).toContain('href="https://en.wikipedia.org/wiki/Eiffel_Tower"');
    expect(out).toContain("<strong>");
    expect(out).toContain('class="katex"');
    expect(out).not.toContain("Paris"); // still hidden
  });

  test("revealed side: cloze text is shown, markdown link/bold/math still render", async () => {
    const out = await renderRichText(renderClozeRevealed(text));
    expect(out).toContain("Paris");
    expect(out).toContain('href="https://en.wikipedia.org/wiki/Eiffel_Tower"');
    expect(out).toContain("<strong>Paris</strong>");
    expect(out).toContain('class="katex"');
  });

  test("markdown link syntax brackets don't collide with cloze's double-brace syntax", async () => {
    // A cloze deletion whose hidden text itself looks like a markdown link.
    const tricky = "See {{c1::[the link](https://example.com)}} for details.";
    const hidden = await renderRichText(renderClozeHidden(tricky));
    expect(hidden).toContain("[...]");
    expect(hidden).not.toContain("href"); // link is inside the still-hidden deletion
    const revealed = await renderRichText(renderClozeRevealed(tricky));
    expect(revealed).toContain('href="https://example.com"');
  });

  test("XSS payload hidden inside a cloze deletion is still neutralized on both sides", async () => {
    const malicious = `Answer: {{c1::${SCRIPT_TAG}}}`;
    const sanitizedSource = sanitizeRichTextSource(malicious);
    const hidden = await renderRichText(renderClozeHidden(sanitizedSource));
    const revealed = await renderRichText(renderClozeRevealed(sanitizedSource));
    expect(hidden).not.toContain("<script");
    expect(revealed).not.toContain("<script");
    expect(revealed).not.toContain("alert(1)");
  });
});

describe("sanitizeCardPayload: write-time sanitization applied per card type", () => {
  test("basic: front/back are sanitized", () => {
    const out = sanitizeCardPayload("basic", { front: SCRIPT_TAG, back: "safe" }) as BasicPayload;
    expect(out.front).not.toContain("<script");
    expect(out.back).toBe("safe");
  });

  test("cloze: text is sanitized but cloze braces survive (they're not HTML tags)", () => {
    const out = sanitizeCardPayload("cloze", { text: `${SCRIPT_TAG}{{c1::Paris}}` }) as ClozePayload;
    expect(out.text).not.toContain("<script");
    expect(out.text).toContain("{{c1::Paris}}");
  });

  test("multiple_choice: question and every option are sanitized", () => {
    const out = sanitizeCardPayload("multiple_choice", {
      question: SCRIPT_TAG,
      options: [IMG_ONERROR, "safe option"],
      correctIndex: 1,
    }) as MultipleChoicePayload;
    expect(out.question).not.toContain("<script");
    expect(out.options[0]).not.toContain("onerror");
    expect(out.options[1]).toBe("safe option");
  });

  test("true_false: statement is sanitized", () => {
    const out = sanitizeCardPayload("true_false", { statement: RAW_HTML_JS_LINK, isTrue: true }) as TrueFalsePayload;
    expect(out.statement).not.toContain("javascript:");
  });

  test("type_answer: prompt and every accepted answer are sanitized", () => {
    const out = sanitizeCardPayload("type_answer", {
      prompt: SCRIPT_TAG,
      acceptedAnswers: [SVG_ONLOAD, "42"],
    }) as TypeAnswerPayload;
    expect(out.prompt).not.toContain("<script");
    expect(out.acceptedAnswers[0]).not.toContain("onload");
    expect(out.acceptedAnswers[1]).toBe("42");
  });

  test("image_occlusion: region labels are sanitized, imageUrl is left untouched", () => {
    const out = sanitizeCardPayload("image_occlusion", {
      imageUrl: "/uploads/foo.png",
      regions: [{ x: 1, y: 2, w: 3, h: 4, label: IMG_ONERROR }],
    }) as { imageUrl: string; regions: Array<{ label: string }> };
    expect(out.imageUrl).toBe("/uploads/foo.png");
    expect(out.regions[0]!.label).not.toContain("onerror");
  });
});

describe("full write -> render pipeline through the real addCard usecase + sqlite repo", () => {
  test("an XSS payload submitted as a card's front/back never survives to the rendered review HTML", async () => {
    await migrateSqlite(db as never);
    const setRepo = createSetRepoSqlite(db as never);
    const cardRepo = createCardRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const user = await userRepo.create({ email: "xss@example.com", passwordHash: "h", displayName: "XSS Tester" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Security", description: "" });

    const card = await addCard(cardRepo, setRepo, {
      setId: set.id,
      ownerId: user.id,
      type: "basic",
      payload: { front: `Question ${SCRIPT_TAG}${IMG_ONERROR}`, back: `Answer ${MARKDOWN_JS_LINK}` },
    });

    // Confirm it was actually sanitized at write time, i.e. the stored row
    // itself never contains the raw payload (defense layer 1 really ran).
    const stored = await cardRepo.findById(card.id);
    const storedPayload = stored!.payload as BasicPayload;
    expect(storedPayload.front).not.toContain("<script");
    expect(storedPayload.front).not.toContain("onerror");

    // Now render it exactly the way the review page does, and confirm layer 2
    // independently produces safe output too.
    const html = await renderCardBodyRich(stored!, "en");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Question");
    expect(html).toContain("Answer");
  });

  test("multiple_choice options with XSS payloads render safely end to end", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const cardRepo = createCardRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const user = await userRepo.create({ email: "xss2@example.com", passwordHash: "h", displayName: "XSS Tester 2" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Security 2", description: "" });

    const card = await addCard(cardRepo, setRepo, {
      setId: set.id,
      ownerId: user.id,
      type: "multiple_choice",
      payload: {
        question: `What is safe? ${SVG_ONLOAD}`,
        // Each option keeps real, non-empty text alongside the payload so it
        // survives write-time sanitization as a legitimate (if XSS-laced)
        // option rather than being validly rejected for being empty.
        options: [`Option A ${SCRIPT_TAG}`, `Option B ${IMG_ONERROR}`, "A correct, boring option", "Another option"],
        correctIndex: 2,
      },
    });

    const stored = await cardRepo.findById(card.id);
    const html = await renderCardBodyRich(stored!, "en");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onload");
    expect(html).toContain("Option A");
    expect(html).toContain("Option B");
    expect(html).toContain("A correct, boring option");
  });
});

describe("renderPreview: modest card-form preview endpoint's rendering function", () => {
  test("renders a basic draft's front/back safely, tolerating missing fields", async () => {
    const html = await renderPreview("basic", { front: "**Front**" } as unknown as BasicPayload);
    expect(html).toContain("<strong>Front</strong>");
  });

  test("sanitizes an XSS payload in a live preview before it's ever saved", async () => {
    const html = await renderPreview("basic", { front: SCRIPT_TAG, back: "ok" });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });
});

describe("feedbackFragmentRich: rich-rendered 'correct answer was' text", () => {
  test("renders markdown in the correct-answer text without a wrapping block <p> that would nest inside the message paragraph", async () => {
    const html = await feedbackFragmentRich({
      correct: false,
      correctAnswerText: "**Paris**",
      queue: [],
      total: 1,
      reviewed: 1,
      locale: "en",
    });
    expect(html).toContain("<strong>Paris</strong>");
    expect(html).toContain("The correct answer was:");
  });

  test("sanitizes an XSS payload in the correct-answer text", async () => {
    const html = await feedbackFragmentRich({
      correct: false,
      correctAnswerText: SCRIPT_TAG,
      queue: [],
      total: 1,
      reviewed: 1,
      locale: "en",
    });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });
});
