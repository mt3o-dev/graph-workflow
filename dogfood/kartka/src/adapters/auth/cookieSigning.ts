import { createHmac, timingSafeEqual } from "node:crypto";

// Signs/verifies an opaque session id for storage in an httpOnly cookie, so a
// tampered cookie value is rejected before we even look it up in the sessions
// table. No external session-store dependency (see spec) — this is just HMAC.

export function signValue(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verifyValue(signed: string, secret: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expectedMac = createHmac("sha256", secret).update(value).digest("base64url");

  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  if (macBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(macBuf, expectedBuf)) return null;
  return value;
}
