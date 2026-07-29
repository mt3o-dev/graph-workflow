import type {
  User,
  UserWithSetCount,
  Locale,
  PageQuery,
  Paginated,
  SchedulerPreference,
  ReadingFont,
  TextSize,
  LineSpacing,
  Contrast,
} from "../domain/types";

export interface UserRepoPort {
  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: "student" | "admin";
    locale?: Locale;
  }): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  count(): Promise<number>;
  /** All users with their owned-set count, paginated/sortable. Admin-only (slice 4) — see adminUsecases.ts. */
  listAll(query: PageQuery): Promise<Paginated<UserWithSetCount>>;
  setBanned(id: string, banned: boolean): Promise<User>;
  /** Count of non-banned admins, optionally excluding one user id. Used for the "don't lock out all admin access" guard in adminUsecases.setUserBanned. */
  countActiveAdmins(excludingUserId?: string): Promise<number>;
  /** Self-service scheduler switch (slice 5) — see authUsecases.changeSchedulerPreference for the ownership-check wrapper callers must use. */
  updateSchedulerPreference(id: string, preference: SchedulerPreference): Promise<User>;
  /** Self-service quiet-hours update (slice 9) — see authUsecases.changeQuietHours for the ownership-check wrapper callers must use. */
  updateQuietHours(id: string, quietHoursStart: string | null, quietHoursEnd: string | null): Promise<User>;
  /** Self-service reading/accessibility profile update (slice 10) — see authUsecases.changeReadingProfile for the ownership-check wrapper callers must use. */
  updateReadingProfile(
    id: string,
    profile: { readingFont: ReadingFont; textSize: TextSize; lineSpacing: LineSpacing; contrast: Contrast },
  ): Promise<User>;
}
