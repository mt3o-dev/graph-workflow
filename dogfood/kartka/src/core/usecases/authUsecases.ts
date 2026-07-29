import type { UserRepoPort } from "../ports/userRepoPort";
import type { AuthPort } from "../ports/authPort";
import type { Locale, SchedulerPreference, Session, User, ReadingFont, TextSize, LineSpacing, Contrast } from "../domain/types";
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

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Self-service quiet-hours update (slice 9), same ownership pattern as
 * changeSchedulerPreference above: `requestingUserId` is always the id
 * written to, never a value taken from the request body. See
 * pages/api/account/quiet-hours.ts.
 *
 * Both fields null clears quiet hours entirely (the default: reminders can
 * fire any time of day). Both must otherwise be well-formed "HH:MM" 24h
 * strings — a null/non-null mix is rejected as ValidationError, since a
 * one-sided window has no sensible meaning (see
 * core/domain/reminderPlanner.ts for how the window itself is interpreted,
 * including the UTC-not-local-timezone simplification).
 */
export async function changeQuietHours(
  userRepo: UserRepoPort,
  requestingUserId: string,
  quietHoursStart: string | null,
  quietHoursEnd: string | null,
): Promise<User> {
  if (quietHoursStart === null && quietHoursEnd === null) {
    return userRepo.updateQuietHours(requestingUserId, null, null);
  }
  if (quietHoursStart === null || quietHoursEnd === null) {
    throw new ValidationError("Quiet hours start and end must be set together");
  }
  if (!HHMM_RE.test(quietHoursStart) || !HHMM_RE.test(quietHoursEnd)) {
    throw new ValidationError("Quiet hours must be in HH:MM 24h format");
  }
  return userRepo.updateQuietHours(requestingUserId, quietHoursStart, quietHoursEnd);
}

const VALID_READING_FONTS: ReadingFont[] = ["system", "opendyslexic"];
const VALID_TEXT_SIZES: TextSize[] = ["normal", "large", "xlarge"];
const VALID_LINE_SPACINGS: LineSpacing[] = ["normal", "relaxed", "loose"];
const VALID_CONTRASTS: Contrast[] = ["normal", "high"];

export interface ReadingProfileInput {
  readingFont: ReadingFont;
  textSize: TextSize;
  lineSpacing: LineSpacing;
  contrast: Contrast;
}

/**
 * Self-service reading/accessibility profile update (slice 10), same
 * ownership pattern as changeSchedulerPreference/changeQuietHours above:
 * `requestingUserId` is always the id written to, never a value taken from
 * the request body. See pages/api/account/reading-profile.ts.
 */
export async function changeReadingProfile(
  userRepo: UserRepoPort,
  requestingUserId: string,
  input: ReadingProfileInput,
): Promise<User> {
  if (!VALID_READING_FONTS.includes(input.readingFont)) throw new ValidationError("Invalid reading font value");
  if (!VALID_TEXT_SIZES.includes(input.textSize)) throw new ValidationError("Invalid text size value");
  if (!VALID_LINE_SPACINGS.includes(input.lineSpacing)) throw new ValidationError("Invalid line spacing value");
  if (!VALID_CONTRASTS.includes(input.contrast)) throw new ValidationError("Invalid contrast value");

  return userRepo.updateReadingProfile(requestingUserId, input);
}
