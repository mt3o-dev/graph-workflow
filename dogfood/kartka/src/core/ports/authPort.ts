import type { Session, User } from "../domain/types";

export interface AuthPort {
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
  createSession(userId: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  destroySession(sessionId: string): Promise<void>;
  /** Signs a session id so it's safe to store in an httpOnly cookie. */
  signCookieValue(sessionId: string): string;
  /** Verifies + unwraps a signed cookie value; null if the signature is invalid. */
  verifyCookieValue(cookieValue: string): string | null;
}

export interface AuthedUser extends Pick<User, "id" | "email" | "displayName" | "role" | "locale"> {}
