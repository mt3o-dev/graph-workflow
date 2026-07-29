import type { User, UserWithSetCount, Locale, PageQuery, Paginated } from "../domain/types";

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
}
