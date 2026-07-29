import { describe, test, expect } from "bun:test";
import { selectUsersForDueReminders, isInsideQuietHours, type ReminderCandidate } from "../src/core/domain/reminderPlanner";

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    userId: "user-1",
    dueCardCount: 3,
    quietHoursStart: null,
    quietHoursEnd: null,
    subscriptionCount: 1,
    ...overrides,
  };
}

describe("isInsideQuietHours", () => {
  test("same-day window: inside the middle of the window is quiet", () => {
    expect(isInsideQuietHours(15 * 60, "13:00", "17:00")).toBe(true); // 15:00
  });

  test("same-day window: exactly at the start minute is inside (quiet) — inclusive start", () => {
    expect(isInsideQuietHours(13 * 60, "13:00", "17:00")).toBe(true);
  });

  test("same-day window: exactly at the end minute is NOT inside (notify allowed) — exclusive end", () => {
    expect(isInsideQuietHours(17 * 60, "13:00", "17:00")).toBe(false);
  });

  test("same-day window: outside is not quiet", () => {
    expect(isInsideQuietHours(12 * 60 + 59, "13:00", "17:00")).toBe(false);
    expect(isInsideQuietHours(17 * 60 + 1, "13:00", "17:00")).toBe(false);
  });

  test("midnight-wrapping window: inside the overnight portion is quiet", () => {
    expect(isInsideQuietHours(23 * 60, "22:00", "07:00")).toBe(true); // 23:00
    expect(isInsideQuietHours(6 * 60, "22:00", "07:00")).toBe(true); // 06:00
  });

  test("midnight-wrapping window: exactly at start minute is inside (quiet) — inclusive start", () => {
    expect(isInsideQuietHours(22 * 60, "22:00", "07:00")).toBe(true);
  });

  test("midnight-wrapping window: exactly at end minute is NOT inside (notify allowed) — exclusive end", () => {
    expect(isInsideQuietHours(7 * 60, "22:00", "07:00")).toBe(false);
  });

  test("midnight-wrapping window: midday is outside", () => {
    expect(isInsideQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
  });

  test("null quiet hours (either or both) is never quiet", () => {
    expect(isInsideQuietHours(12 * 60, null, null)).toBe(false);
    expect(isInsideQuietHours(12 * 60, "22:00", null)).toBe(false);
    expect(isInsideQuietHours(12 * 60, null, "07:00")).toBe(false);
  });

  test("degenerate zero-width window (start === end) is never quiet", () => {
    expect(isInsideQuietHours(12 * 60, "10:00", "10:00")).toBe(false);
  });

  test("malformed HH:MM strings are treated as no quiet hours", () => {
    expect(isInsideQuietHours(12 * 60, "not-a-time", "07:00")).toBe(false);
    expect(isInsideQuietHours(12 * 60, "25:00", "07:00")).toBe(false);
  });
});

describe("selectUsersForDueReminders", () => {
  test("a user with due cards, no quiet hours, and a subscription is notified", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const selected = selectUsersForDueReminders([candidate()], now);
    expect(selected).toEqual(["user-1"]);
  });

  test("a user with zero due cards is skipped", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const selected = selectUsersForDueReminders([candidate({ dueCardCount: 0 })], now);
    expect(selected).toEqual([]);
  });

  test("a user with no subscriptions is skipped", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const selected = selectUsersForDueReminders([candidate({ subscriptionCount: 0 })], now);
    expect(selected).toEqual([]);
  });

  test("a user currently inside their quiet-hours window is skipped", () => {
    const now = new Date("2026-01-01T23:30:00Z"); // 23:30 UTC
    const selected = selectUsersForDueReminders(
      [candidate({ quietHoursStart: "22:00", quietHoursEnd: "07:00" })],
      now,
    );
    expect(selected).toEqual([]);
  });

  test("a user outside their quiet-hours window (even though one is configured) is notified", () => {
    const now = new Date("2026-01-01T12:00:00Z"); // noon UTC, well outside 22:00-07:00
    const selected = selectUsersForDueReminders(
      [candidate({ quietHoursStart: "22:00", quietHoursEnd: "07:00" })],
      now,
    );
    expect(selected).toEqual(["user-1"]);
  });

  test("mixed batch: only the eligible users are selected, in input order", () => {
    const now = new Date("2026-01-01T23:30:00Z"); // 23:30 UTC
    const candidates: ReminderCandidate[] = [
      candidate({ userId: "eligible", dueCardCount: 2 }),
      candidate({ userId: "no-due-cards", dueCardCount: 0 }),
      candidate({ userId: "no-subscription", subscriptionCount: 0 }),
      candidate({ userId: "in-quiet-hours", quietHoursStart: "22:00", quietHoursEnd: "07:00" }),
      candidate({ userId: "also-eligible", dueCardCount: 5 }),
    ];
    expect(selectUsersForDueReminders(candidates, now)).toEqual(["eligible", "also-eligible"]);
  });
});
