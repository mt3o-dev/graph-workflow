import { describe, test, expect } from "bun:test";
import qrcodegen from "qrcode-generator";
import { renderQrCodeSvg } from "../src/lib/qr";

// Slice 13 (host screen): renderQrCodeSvg wraps `qrcode-generator` (a
// well-established, zero-dependency MIT library — see that file's header
// comment for why this wasn't hand-rolled) but the SVG markup itself is
// hand-built here, so it gets the same "at minimum, structural sanity
// checks" treatment the roadmap asks for on any QR-encoding output: valid,
// well-formed SVG, a real module grid (not an empty/broken render), and
// deterministic + non-degenerate across a few different input lengths.
describe("renderQrCodeSvg", () => {
  test("produces a well-formed inline <svg> at the requested size", () => {
    const svg = renderQrCodeSvg("https://kartka.example.com/live/enter?code=ABCDE", { size: 240 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 240 240"');
    expect(svg).toContain('width="240"');
    expect(svg).toContain('height="240"');
  });

  test("renders a real module grid, not an empty image (at least one dark <rect>)", () => {
    const svg = renderQrCodeSvg("https://kartka.example.com/live/enter?code=ABCDE");
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    // 1 background rect + at least one module-run rect.
    expect(rectCount).toBeGreaterThan(1);
  });

  test("is deterministic: the same input always produces the same output", () => {
    const a = renderQrCodeSvg("https://kartka.example.com/live/enter?code=QWERT");
    const b = renderQrCodeSvg("https://kartka.example.com/live/enter?code=QWERT");
    expect(a).toBe(b);
  });

  test("handles a range of input lengths without throwing, and produces differing output", () => {
    const short = renderQrCodeSvg("A");
    const medium = renderQrCodeSvg("https://kartka.example.com/live/enter?code=ABCDE");
    const long = renderQrCodeSvg(
      "https://kartka.example.com/live/enter?code=ABCDE&lang=pl&extra=" + "x".repeat(200),
    );
    expect(short).toContain("<svg");
    expect(medium).toContain("<svg");
    expect(long).toContain("<svg");
    expect(short).not.toBe(medium);
    expect(medium).not.toBe(long);
  });

  test("includes an accessible label as a <title> + role=img when provided, otherwise is marked decorative", () => {
    const labeled = renderQrCodeSvg("https://example.com", { label: "Scan to join" });
    expect(labeled).toContain("<title>Scan to join</title>");
    expect(labeled).toContain('role="img"');

    const unlabeled = renderQrCodeSvg("https://example.com");
    expect(unlabeled).toContain('aria-hidden="true"');
  });

  // Regression coverage for a review finding: the earlier version of this
  // suite only checked structural well-formedness (valid SVG, non-empty,
  // deterministic) but never cross-checked that the hand-built rect-merging
  // logic actually reproduces the real qrcode-generator matrix — a rect-run
  // off-by-one (dropping/misplacing a module at a run boundary) would have
  // slipped through every test above undetected. This test reconstructs the
  // dark/light grid from the rendered SVG's <rect> runs and compares it,
  // module by module, against the library's own getModuleCount()/isDark()
  // output for several input lengths/error-correction-relevant sizes.
  test("every dark module in the library's matrix is represented by exactly one rendered rect run, with no extras", () => {
    const margin = 2;
    const size = 240;

    for (const text of ["A", "https://kartka.example.com/live/enter?code=ABCDE", "x".repeat(300)]) {
      const svg = renderQrCodeSvg(text, { size, margin });

      const qr = qrcodegen(0, "M");
      qr.addData(text);
      qr.make();
      const moduleCount = qr.getModuleCount();
      const cell = size / (moduleCount + margin * 2);

      // Reconstruct which (row, col) cells the rendered rects cover.
      const rendered = new Set<string>();
      const rectRe = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g;
      let match: RegExpExecArray | null;
      while ((match = rectRe.exec(svg)) !== null) {
        const [, xStr, yStr, wStr] = match;
        const x = Number.parseFloat(xStr!);
        const y = Number.parseFloat(yStr!);
        const w = Number.parseFloat(wStr!);
        const row = Math.round(y / cell - margin);
        const colStart = Math.round(x / cell - margin);
        const runLength = Math.round(w / cell);
        for (let i = 0; i < runLength; i++) rendered.add(`${row},${colStart + i}`);
      }
      // Skip the one full-canvas background <rect> (no x/y attrs to match the pattern above — regex requires x=/y=, background rect has no x/y at all, so it never matches; nothing to filter out here).

      let darkCount = 0;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          const isDark = qr.isDark(row, col);
          if (isDark) darkCount++;
          expect(rendered.has(`${row},${col}`)).toBe(isDark);
        }
      }
      expect(darkCount).toBeGreaterThan(0); // sanity: the matrix itself isn't degenerate
      expect(rendered.size).toBe(darkCount); // no extra/phantom modules rendered
    }
  });
});
