import { describe, test, expect } from "bun:test";
import { levenshtein, isFuzzyMatch, matchesAnyAccepted } from "../src/core/domain/levenshtein";

describe("levenshtein", () => {
  test("distance of identical strings is 0", () => {
    expect(levenshtein("paris", "paris")).toBe(0);
  });

  test("distance counts single-character edits", () => {
    expect(levenshtein("cat", "cot")).toBe(1); // substitution
    expect(levenshtein("cat", "cats")).toBe(1); // insertion
    expect(levenshtein("cats", "cat")).toBe(1); // deletion
  });

  test("classic kitten/sitting example", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  test("empty string distance equals the other string's length", () => {
    expect(levenshtein("", "hello")).toBe(5);
    expect(levenshtein("hello", "")).toBe(5);
  });
});

describe("isFuzzyMatch", () => {
  test("exact match after trim/case-normalization passes", () => {
    expect(isFuzzyMatch("  Paris  ", "paris")).toBe(true);
    expect(isFuzzyMatch("PARIS", "Paris")).toBe(true);
  });

  test("small typos on longer answers are tolerated", () => {
    expect(isFuzzyMatch("mitochondrion", "mitochondrian")).toBe(true);
  });

  test("very different strings do not match", () => {
    expect(isFuzzyMatch("paris", "london")).toBe(false);
  });

  test("empty answers never match", () => {
    expect(isFuzzyMatch("", "paris")).toBe(false);
  });
});

describe("matchesAnyAccepted", () => {
  test("matches if any accepted answer fuzzy-matches", () => {
    expect(matchesAnyAccepted("nyc", ["new york city", "nyc", "big apple"])).toBe(true);
  });

  test("returns false when none match", () => {
    expect(matchesAnyAccepted("chicago", ["new york city", "nyc"])).toBe(false);
  });
});
