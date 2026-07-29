// Shared multipart/form-data -> CardPayload mapping. Extracted (slice 7) so
// both the real card-create endpoint (api/sets/[id]/cards.ts) and the
// render-only preview endpoint (api/cards/preview.ts) build the exact same
// payload shape from the exact same form fields — a drifted second copy here
// would be an easy way to make the preview show something different from
// what actually gets saved.
import type { CardPayload, CardType } from "../core/domain/types";

export function payloadFromForm(type: CardType, form: FormData): CardPayload {
  switch (type) {
    case "basic":
      return { front: String(form.get("front") ?? ""), back: String(form.get("back") ?? "") };
    case "cloze":
      return { text: String(form.get("text") ?? "") };
    case "multiple_choice": {
      const options = form.getAll("options").map(String).filter((o) => o.trim().length > 0);
      return {
        question: String(form.get("question") ?? ""),
        options,
        correctIndex: Number(form.get("correctIndex") ?? 0),
      };
    }
    case "true_false":
      return { statement: String(form.get("statement") ?? ""), isTrue: form.get("isTrue") === "on" };
    case "type_answer":
      return {
        prompt: String(form.get("prompt") ?? ""),
        acceptedAnswers: String(form.get("acceptedAnswers") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "image_occlusion": {
      const xs = form.getAll("region_x").map(Number);
      const ys = form.getAll("region_y").map(Number);
      const ws = form.getAll("region_w").map(Number);
      const hs = form.getAll("region_h").map(Number);
      const labels = form.getAll("region_label").map(String);
      const regions = xs.map((x, i) => ({ x, y: ys[i] ?? 0, w: ws[i] ?? 0, h: hs[i] ?? 0, label: labels[i] ?? "" }));
      return { imageUrl: String(form.get("imageUrl") ?? ""), regions };
    }
  }
}
