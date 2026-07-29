// Slice 13 (host screen): server-rendered inline SVG QR codes for the
// lobby's "join by scanning" moment — no client-side QR library, matching
// this app's "server owns the markup" ethos (see docs/ADR-live-transport.md's
// fragment-over-JSON rationale, the same reasoning applied here to images).
//
// `qrcode-generator` (kazuhikoarase, MIT, zero runtime dependencies) is used
// ONLY for its pure matrix builder (getModuleCount/isDark) — a hand-rolled
// QR encoder (version selection, Reed-Solomon error correction, mask
// evaluation) is a well-trodden, easy-to-get-subtly-wrong algorithm with no
// upside to reinventing for a single-error-correction-level use case; this
// package is the de facto standard minimal JS implementation (no deps of its
// own, ~1000 lines, widely used) rather than a heavier client-canvas-first
// library. The actual SVG markup below is hand-built from the library's
// matrix (not its own createSvgTag) so we control sizing/color/accessibility
// ourselves instead of inheriting fixed-pixel defaults.
import qrcodegen from "qrcode-generator";

export interface RenderQrCodeSvgOptions {
  /** Rendered width/height in CSS pixels (square). Default 240 — readable from a few meters on a projector. */
  size?: number;
  /** Quiet-zone border, in QR modules (not pixels). Default 2, small but spec-compliant. */
  margin?: number;
  /** Accessible label for the image (e.g. "Scan to join room ABCDE"). */
  label?: string;
}

/**
 * Renders `text` (e.g. a join URL) as an inline `<svg>` string. Deterministic
 * for a given input — same text always produces the same matrix.
 */
export function renderQrCodeSvg(text: string, opts: RenderQrCodeSvgOptions = {}): string {
  const size = opts.size ?? 240;
  const margin = opts.margin ?? 2;

  const qr = qrcodegen(0, "M"); // type 0 = auto-select the smallest version that fits `text`
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + margin * 2;
  const cell = size / totalModules;

  // One <rect> per horizontal run of dark modules (not one per module) —
  // keeps the markup for a typical join-URL-length code to a few KB.
  const rects: string[] = [];
  for (let row = 0; row < moduleCount; row++) {
    let runStart = -1;
    for (let col = 0; col <= moduleCount; col++) {
      const dark = col < moduleCount && qr.isDark(row, col);
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        const x = (runStart + margin) * cell;
        const y = (row + margin) * cell;
        const w = (col - runStart) * cell;
        rects.push(`<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${cell.toFixed(3)}"/>`);
        runStart = -1;
      }
    }
  }

  const titleTag = opts.label ? `<title>${escapeXml(opts.label)}</title>` : "";
  const role = opts.label ? `role="img"` : `role="presentation" aria-hidden="true"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ${role} shape-rendering="crispEdges">${titleTag}<rect width="${size}" height="${size}" fill="#ffffff"/><g fill="#0a0a0a">${rects.join("")}</g></svg>`;
}

/** Minimal XML-escaping for the <title> element (SVG's text-node escaping rules match HTML's for these five). */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
