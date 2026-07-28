import type { CardPayload, CardType } from "./types";
import { ValidationError } from "./errors";

/** Validates a card payload shape for its declared type. Throws ValidationError on failure. */
export function validateCardPayload(type: CardType, payload: CardPayload): void {
  switch (type) {
    case "basic": {
      const p = payload as { front?: unknown; back?: unknown };
      if (!isNonEmptyString(p.front)) throw new ValidationError("Front is required");
      if (!isNonEmptyString(p.back)) throw new ValidationError("Back is required");
      return;
    }
    case "cloze": {
      const p = payload as { text?: unknown };
      if (!isNonEmptyString(p.text)) throw new ValidationError("Cloze text is required");
      if (!/\{\{c\d+::.+?\}\}/.test(p.text)) {
        throw new ValidationError("Cloze text must contain at least one {{c1::...}} deletion");
      }
      return;
    }
    case "multiple_choice": {
      const p = payload as { question?: unknown; options?: unknown; correctIndex?: unknown };
      if (!isNonEmptyString(p.question)) throw new ValidationError("Question is required");
      if (!Array.isArray(p.options) || p.options.length < 2) {
        throw new ValidationError("At least two options are required");
      }
      if (p.options.some((o) => !isNonEmptyString(o))) {
        throw new ValidationError("Options cannot be empty");
      }
      if (
        typeof p.correctIndex !== "number" ||
        p.correctIndex < 0 ||
        p.correctIndex >= p.options.length
      ) {
        throw new ValidationError("correctIndex must point at a valid option");
      }
      return;
    }
    case "true_false": {
      const p = payload as { statement?: unknown; isTrue?: unknown };
      if (!isNonEmptyString(p.statement)) throw new ValidationError("Statement is required");
      if (typeof p.isTrue !== "boolean") throw new ValidationError("isTrue must be a boolean");
      return;
    }
    case "type_answer": {
      const p = payload as { prompt?: unknown; acceptedAnswers?: unknown };
      if (!isNonEmptyString(p.prompt)) throw new ValidationError("Prompt is required");
      if (!Array.isArray(p.acceptedAnswers) || p.acceptedAnswers.length === 0) {
        throw new ValidationError("At least one accepted answer is required");
      }
      if (p.acceptedAnswers.some((a) => !isNonEmptyString(a))) {
        throw new ValidationError("Accepted answers cannot be empty");
      }
      return;
    }
    case "image_occlusion": {
      const p = payload as { imageUrl?: unknown; regions?: unknown };
      if (!isNonEmptyString(p.imageUrl)) throw new ValidationError("Image is required");
      if (!Array.isArray(p.regions) || p.regions.length === 0) {
        throw new ValidationError("At least one occlusion region is required");
      }
      for (const r of p.regions as Array<Record<string, unknown>>) {
        for (const key of ["x", "y", "w", "h"] as const) {
          if (typeof r[key] !== "number" || r[key] < 0 || (r[key] as number) > 100) {
            throw new ValidationError(`Region ${key} must be a percentage between 0 and 100`);
          }
        }
        if (!isNonEmptyString(r.label)) throw new ValidationError("Every region needs a label");
      }
      return;
    }
    default: {
      const _exhaustive: never = type;
      throw new ValidationError(`Unknown card type: ${_exhaustive as string}`);
    }
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
