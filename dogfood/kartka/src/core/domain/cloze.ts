// Pure helpers for {{c1::hidden text}} style cloze deletions.

export interface ClozeDeletion {
  index: number; // the "1" in {{c1::...}}
  text: string;
}

const CLOZE_RE = /\{\{c(\d+)::(.+?)\}\}/g;

export function parseClozeDeletions(raw: string): ClozeDeletion[] {
  const deletions: ClozeDeletion[] = [];
  for (const match of raw.matchAll(CLOZE_RE)) {
    deletions.push({ index: Number(match[1]), text: match[2] ?? "" });
  }
  return deletions;
}

/** Renders the cloze text with deletions replaced by a blank placeholder (hidden state). */
export function renderClozeHidden(raw: string): string {
  return raw.replace(CLOZE_RE, "[...]");
}

/** Renders the cloze text with deletions revealed (flip/answer state). */
export function renderClozeRevealed(raw: string): string {
  return raw.replace(CLOZE_RE, (_m, _i, text) => text);
}
