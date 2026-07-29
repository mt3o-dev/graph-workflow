// Slice 13 (host screen): the join URL encoded into the lobby's QR code.
// Pure string construction, no I/O — kept separate from liveFragments.ts so
// it's trivially unit-testable (see tests/liveJoinUrl.test.ts) without
// dragging in i18n/HTML-escaping concerns.
//
// Points at /live/enter?code=XXXXX — src/pages/live/enter.astro (slice 11)
// is exactly the "take a code, validate its shape, redirect to the
// canonical /live/{CODE} room page" route this link needs; it already
// exists for the manual "type this code" flow (see join.astro's form
// action), so a scanned QR reuses the same validated entrypoint instead of
// linking straight to /live/{CODE} and skipping that validation.
export function buildLiveJoinUrl(siteUrl: string, code: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/live/enter?code=${encodeURIComponent(code.toUpperCase())}`;
}
