import { describe, test, expect } from "bun:test";
import { buildLiveJoinUrl } from "../src/lib/liveJoinUrl";

// Slice 13 (host screen): pure string construction, no I/O — the QR code's
// payload, so this is exactly the "does it produce the correct join URL for
// a given room code" case the roadmap calls out as trivially testable.
describe("buildLiveJoinUrl", () => {
  test("builds the /live/enter?code=... URL against a bare site URL", () => {
    expect(buildLiveJoinUrl("http://localhost:4321", "ABCDE")).toBe("http://localhost:4321/live/enter?code=ABCDE");
  });

  test("strips a trailing slash on the site URL so the result never double-slashes", () => {
    expect(buildLiveJoinUrl("https://kartka.example.com/", "WXY12")).toBe(
      "https://kartka.example.com/live/enter?code=WXY12",
    );
  });

  test("uppercases a lowercase/mixed-case room code (codes are always canonically uppercase)", () => {
    expect(buildLiveJoinUrl("https://kartka.example.com", "abcde")).toBe(
      "https://kartka.example.com/live/enter?code=ABCDE",
    );
  });

  test("is stable across different code values (no shared mutable state)", () => {
    const first = buildLiveJoinUrl("https://kartka.example.com", "AAAAA");
    const second = buildLiveJoinUrl("https://kartka.example.com", "ZZZZZ");
    expect(first).not.toBe(second);
    expect(first).toContain("AAAAA");
    expect(second).toContain("ZZZZZ");
  });
});
