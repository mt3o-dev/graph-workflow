// Pure domain logic for share-link slugs (slice 3). Zero imports from
// adapters/*, astro:*, or any framework — see docs/architecture.md.
//
// Slugs are base62 (URL-safe, no punctuation to percent-encode), generated
// once at Set creation and never changed. They are deliberately NOT derived
// from the set id/title (that would make them guessable/enumerable) — they
// come from crypto.getRandomValues, a Web Crypto API available in both Bun
// and the browser, so this stays framework-free.

const SLUG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SLUG_LENGTH = 10;
// 62^10 ≈ 8.4 * 10^17 possible slugs — collision-checked at insert time by
// the repo (see setRepo.*.ts), not relied upon here.
export const SLUG_RE = new RegExp(`^[0-9A-Za-z]{${SLUG_LENGTH}}$`);

export function generateSlug(length: number = SLUG_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  }
  return out;
}

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}
