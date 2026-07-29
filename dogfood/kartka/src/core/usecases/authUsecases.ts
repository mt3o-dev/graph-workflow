import type { UserRepoPort } from "../ports/userRepoPort";
import type { AuthPort } from "../ports/authPort";
import type { Locale, SchedulerPreference, Session, User } from "../domain/types";
import { ConflictError, ValidationError } from "../domain/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  locale?: Locale;
}

export async function signup(userRepo: UserRepoPort, auth: AuthPort, input: SignupInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError("Invalid email address");
  if (input.password.length < 8) throw new ValidationError("Password must be at least 8 characters");
  if (input.displayName.trim().length === 0) throw new ValidationError("Display name is required");

  const existing = await userRepo.findByEmail(email);
  if (existing) throw new ConflictError("An account with this email already exists");

  const passwordHash = await auth.hashPassword(input.password);
  return userRepo.create({
    email,
    passwordHash,
    displayName: input.displayName.trim(),
    locale: input.locale ?? "pl",
  });
}

export interface LoginInput {
  email: string;
  password: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
  }
}

export class BannedUserError extends Error {
  constructor() {
    super("This account has been suspended");
  }
}

export async function login(
  userRepo: UserRepoPort,
  auth: AuthPort,
  input: LoginInput,
): Promise<{ user: User; session: Session }> {
  const email = input.email.trim().toLowerCase();
  const user = await userRepo.findByEmail(email);
  if (!user) throw new InvalidCredentialsError();

  const ok = await auth.verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();
  if (user.banned) throw new BannedUserError();

  const session = await auth.createSession(user.id);
  return { user, session };
}

export async function logout(auth: AuthPort, sessionId: string): Promise<void> {
  await auth.destroySession(sessionId);
}

const VALID_SCHEDULER_PREFERENCES: SchedulerPreference[] = ["sm2", "fsrs"];

/**
 * Self-service scheduler switch (slice 5). Takes `requestingUserId` and
 * always writes to that same id — there is no "target user id" parameter,
 * so the API route calling this can never be tricked into changing someone
 * else's preference no matter what the request body contains (the class of
 * bug flagged repeatedly in prior slices' reviews: a missing ownership
 * check). See pages/api/account/scheduler-preference.ts.
 */
export async function changeSchedulerPreference(
  userRepo: UserRepoPort,
  requestingUserId: string,
  preference: SchedulerPreference,
): Promise<User> {
  if (!VALID_SCHEDULER_PREFERENCES.includes(preference)) {
    throw new ValidationError("Invalid scheduler preference value");
  }
  return userRepo.updateSchedulerPreference(requestingUserId, preference);
}
