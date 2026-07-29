// Pure selection logic for slice 9's due-card reminders. Zero imports from
// adapters/*, astro:*, ports, or web-push — see docs/architecture.md's
// hexagonal boundary rule. reminderUsecases.ts (the orchestration layer)
// gathers the real ReminderCandidate[] input (due-card counts, subscription
// counts, quiet hours) from the ports and hands it here; this function only
// ever reasons over that already-fetched data plus `now`, so it's cheaply
// unit-testable without a database.
//
// TIMEZONE SIMPLIFICATION (be explicit, not silently wrong): quiet hours are
// interpreted in UTC, not the reviewing user's own local timezone. A user in
// e.g. UTC+2 who sets "22:00-07:00" is actually quiet 00:00-09:00 their own
// local time. This is a known, disclosed gap (see docs/TODO.md) — real
// per-user timezone handling would need a stored IANA zone name plus a
// timezone-database dependency, which is out of scope for this slice.

export interface ReminderCandidate {
  userId: string;
  /** Number of cards due for review right now, under this user's chosen scheduler. */
  dueCardCount: number;
  /** "HH:MM" 24h, UTC — see the timezone note above. Both null or both set. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  /** How many live push subscriptions this user has (0 = never notify). */
  subscriptionCount: number;
}

function parseMinutesOfDay(hhmm: string): number | null {
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(hhmm);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Whether `nowMinutes` (minutes since UTC midnight) falls inside the quiet
 * window [start, end).
 *
 * Boundary convention (exact, tested): the start minute itself IS inside the
 * window (quiet — skip), the end minute itself is NOT inside the window
 * (quiet hours have just ended — notify is allowed again). This matches how
 * "quiet from 22:00 to 07:00" reads in plain language: quiet starts exactly
 * at 22:00, and is over exactly at 07:00, not 07:01.
 *
 * Handles a window that wraps midnight (start > end, e.g. 22:00-07:00) as
 * well as a same-day window (start < end, e.g. 13:00-17:00). A degenerate
 * window where start === end is treated as "never quiet" (an empty range),
 * not "quiet all day" — there's no sensible reading of a zero-width window
 * as "all day."
 */
export function isInsideQuietHours(nowMinutes: number, quietHoursStart: string | null, quietHoursEnd: string | null): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;
  const start = parseMinutesOfDay(quietHoursStart);
  const end = parseMinutesOfDay(quietHoursEnd);
  if (start === null || end === null || start === end) return false;

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  // Wraps midnight.
  return nowMinutes >= start || nowMinutes < end;
}

/**
 * Returns the userIds that should receive a due-card reminder right now.
 * Skips: zero due cards, zero subscriptions, or `now` falling inside that
 * user's quiet-hours window (see isInsideQuietHours above). Order of the
 * input candidates is preserved in the output.
 */
export function selectUsersForDueReminders(candidates: ReminderCandidate[], now: Date): string[] {
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const selected: string[] = [];
  for (const candidate of candidates) {
    if (candidate.dueCardCount <= 0) continue;
    if (candidate.subscriptionCount <= 0) continue;
    if (isInsideQuietHours(nowMinutes, candidate.quietHoursStart, candidate.quietHoursEnd)) continue;
    selected.push(candidate.userId);
  }
  return selected;
}
