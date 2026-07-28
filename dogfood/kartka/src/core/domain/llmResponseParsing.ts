// Defensive parsing of raw LLM output into validated CardDrafts. Nothing in
// here ever throws past extractJsonPayload's JSON.parse — a malformed LLM
// response must show an error state, not crash the page (slice 2 requirement).
import type { CardDraft, CardType } from "./types";
import { validateCardPayload } from "./cardValidation";

const CARD_TYPES: CardType[] = [
  "basic",
  "cloze",
  "multiple_choice",
  "true_false",
  "type_answer",
  "image_occlusion",
];

/**
 * Extracts a JSON value from raw LLM chat output: prefers a fenced ```json
 * block if present (defensive fallback for models that ignore JSON-mode and
 * wrap output in prose + a code fence), otherwise parses the whole trimmed
 * string. Throws (SyntaxError) if nothing parses — callers must catch this.
 */
export function extractJsonPayload(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  return JSON.parse(candidate);
}

/**
 * Coerces a parsed LLM payload into a raw array of draft-shaped candidates.
 * Accepts either a bare array or `{ drafts: [...] }`. Never throws — returns
 * an empty array for anything else so callers can treat "no drafts" as a
 * normal (if disappointing) outcome rather than an error.
 */
export function draftsFromLlmPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { drafts?: unknown }).drafts)) {
    return (payload as { drafts: unknown[] }).drafts;
  }
  return [];
}

/**
 * Validates+filters raw draft candidates against the real card-payload
 * validator. Invalid entries (wrong type, malformed payload, garbage fields)
 * are silently dropped rather than thrown — one bad card in the LLM's
 * response must not sink the whole batch.
 */
export function validateDrafts(raw: unknown[]): CardDraft[] {
  const out: CardDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { type, payload, confidence, rationale } = item as Record<string, unknown>;
    if (typeof type !== "string" || !CARD_TYPES.includes(type as CardType)) continue;
    if (!payload || typeof payload !== "object") continue;

    try {
      validateCardPayload(type as CardType, payload as never);
    } catch {
      continue;
    }

    const conf =
      typeof confidence === "number" && Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5;
    const rat = typeof rationale === "string" ? rationale.slice(0, 500) : "";

    out.push({ type: type as CardType, payload: payload as never, confidence: conf, rationale: rat });
  }
  return out;
}
