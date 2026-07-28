import { describe, test, expect } from "bun:test";
import { extractJsonPayload, draftsFromLlmPayload, validateDrafts } from "../src/core/domain/llmResponseParsing";

describe("extractJsonPayload", () => {
  test("parses plain JSON", () => {
    expect(extractJsonPayload('{"drafts": []}')).toEqual({ drafts: [] });
  });

  test("parses a fenced ```json code block, ignoring surrounding prose", () => {
    const raw = 'Sure, here are the cards:\n```json\n{"drafts": [{"type": "basic"}]}\n```\nHope that helps!';
    expect(extractJsonPayload(raw)).toEqual({ drafts: [{ type: "basic" }] });
  });

  test("throws on garbage input (caller must catch this)", () => {
    expect(() => extractJsonPayload("not json at all, sorry!")).toThrow();
  });
});

describe("draftsFromLlmPayload", () => {
  test("accepts a bare array", () => {
    expect(draftsFromLlmPayload([{ type: "basic" }])).toEqual([{ type: "basic" }]);
  });

  test("accepts { drafts: [...] }", () => {
    expect(draftsFromLlmPayload({ drafts: [{ type: "basic" }] })).toEqual([{ type: "basic" }]);
  });

  test("returns [] for anything else instead of throwing", () => {
    expect(draftsFromLlmPayload(null)).toEqual([]);
    expect(draftsFromLlmPayload("garbage")).toEqual([]);
    expect(draftsFromLlmPayload({ notDrafts: 1 })).toEqual([]);
    expect(draftsFromLlmPayload(42)).toEqual([]);
  });
});

describe("validateDrafts (garbage LLM output must never crash the page)", () => {
  test("keeps only valid, well-typed drafts and drops the rest", () => {
    const raw = [
      { type: "basic", payload: { front: "Q", back: "A" }, confidence: 0.9, rationale: "good pair" },
      { type: "basic", payload: { front: "" /* missing back */ } }, // invalid: fails validateCardPayload
      { type: "not_a_real_type", payload: { front: "x", back: "y" } }, // invalid: unknown type
      { type: "cloze", payload: { text: "no deletion here" } }, // invalid: no {{c1::...}}
      "just a string", // garbage
      null,
      42,
      { type: "cloze", payload: { text: "The capital of France is {{c1::Paris}}." } },
    ];

    const result = validateDrafts(raw);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe("basic");
    expect(result[0]!.confidence).toBe(0.9);
    expect(result[1]!.type).toBe("cloze");
    // default confidence/rationale applied when the model omits them
    expect(result[1]!.confidence).toBe(0.5);
    expect(result[1]!.rationale).toBe("");
  });

  test("clamps out-of-range confidence into [0, 1]", () => {
    const raw = [
      { type: "basic", payload: { front: "Q", back: "A" }, confidence: 5 },
      { type: "basic", payload: { front: "Q2", back: "A2" }, confidence: -3 },
    ];
    const result = validateDrafts(raw);
    expect(result[0]!.confidence).toBe(1);
    expect(result[1]!.confidence).toBe(0);
  });

  test("returns [] for a completely malformed payload without throwing", () => {
    expect(() => validateDrafts([{}, [], "x", 1, null, undefined])).not.toThrow();
    expect(validateDrafts([{}, [], "x", 1, null, undefined])).toEqual([]);
  });
});
