import type { User, Locale } from "../domain/types";

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
}
