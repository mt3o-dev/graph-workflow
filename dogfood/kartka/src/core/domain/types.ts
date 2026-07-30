// Pure domain types. Zero imports from adapters/*, astro:*, or any framework.

export type Role = "student" | "admin";
export type Locale = "pl" | "en";
export type Visibility = "private" | "unlisted" | "public";
/** Which SchedulerPort implementation reviewUsecases.ts uses for this user. See fsrs.ts / roadmap.md slice 5. */
export type SchedulerPreference = "sm2" | "fsrs";

/** Slice 10 (reading/accessibility profile): four independent self-service preferences, each its own column on `User` — same one-column-per-field pattern as schedulerPreference, not a combined JSON blob. */
export type ReadingFont = "system" | "opendyslexic";
export type TextSize = "normal" | "large" | "xlarge";
export type LineSpacing = "normal" | "relaxed" | "loose";
export type Contrast = "normal" | "high";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  banned: boolean;
  locale: Locale;
  /** Defaults to "sm2" — switching to "fsrs" never resets existing progress, see reviewUsecases.ts / fsrs.ts bootstrap. */
  schedulerPreference: SchedulerPreference;
  /**
   * Slice 9 (due-card reminders): opt-in quiet-hours window, "HH:MM" 24h
   * strings. Both null (default, no quiet hours) or both set — see
   * authUsecases.changeQuietHours for the validation. SIMPLIFICATION:
   * interpreted in UTC, not this user's own local timezone — see
   * core/domain/reminderPlanner.ts's header comment and docs/TODO.md.
   */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  /**
   * Slice 10: per-user reading/accessibility profile — four independent
   * self-service knobs (font, text size, line spacing, contrast), each
   * defaulting to its least-surprising "off" value. See
   * authUsecases.changeReadingProfile for the validation and
   * layouts/BaseLayout.astro for how these become `data-*` attributes on
   * `<html>` (same pattern as schedulerPreference).
   */
  readingFont: ReadingFont;
  textSize: TextSize;
  lineSpacing: LineSpacing;
  contrast: Contrast;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface CardSet {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: Visibility;
  /** Stable, unguessable, URL-safe share-link identifier. Immutable once set. See core/domain/slug.ts. */
  slug: string;
  /**
   * Slice 8 (cram mode): nullable, opt-in. When set, the owner can start a
   * cram session (see core/domain/cramPlanner.ts) that re-prioritizes which
   * of this set's cards are selected for review, without ever touching
   * stored ReviewState/FsrsReviewState — see cramUsecases.ts for the safety
   * constraint. null (the default for every set) means purely normal
   * spaced-repetition scheduling, same as before this slice existed.
   */
  examDate: Date | null;
  createdAt: Date;
}

export type CardType =
  | "basic"
  | "cloze"
  | "multiple_choice"
  | "true_false"
  | "type_answer"
  | "image_occlusion";

export interface BasicPayload {
  front: string;
  back: string;
}

export interface ClozePayload {
  /** Raw text containing one or more {{c1::hidden text}} style deletions. */
  text: string;
}

export interface MultipleChoicePayload {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TrueFalsePayload {
  statement: string;
  isTrue: boolean;
}

export interface TypeAnswerPayload {
  prompt: string;
  acceptedAnswers: string[];
}

export interface OcclusionRegion {
  /** x, y, w, h as percentages (0-100) of the image's width/height. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface ImageOcclusionPayload {
  imageUrl: string;
  regions: OcclusionRegion[];
}

export type CardPayload =
  | BasicPayload
  | ClozePayload
  | MultipleChoicePayload
  | TrueFalsePayload
  | TypeAnswerPayload
  | ImageOcclusionPayload;

export interface Card<TType extends CardType = CardType> {
  id: string;
  setId: string;
  type: TType;
  payload: TType extends "basic"
    ? BasicPayload
    : TType extends "cloze"
      ? ClozePayload
      : TType extends "multiple_choice"
        ? MultipleChoicePayload
        : TType extends "true_false"
          ? TrueFalsePayload
          : TType extends "type_answer"
            ? TypeAnswerPayload
            : TType extends "image_occlusion"
              ? ImageOcclusionPayload
              : never;
  createdAt: Date;
}

export interface ReviewState {
  cardId: string;
  userId: string;
  easiness: number;
  interval: number;
  repetitions: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

/**
 * Per-(card,user) FSRS scheduling state (slice 5) — kept as its own type
 * rather than widening ReviewState, since {difficulty,stability} don't mean
 * the same thing as SM-2's {easiness,interval,repetitions} even though both
 * pairs serve the same role. See core/ports/schedulerPort.ts and fsrs.ts.
 */
export interface FsrsReviewState {
  cardId: string;
  userId: string;
  difficulty: number;
  stability: number;
  reps: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
}

/** 0-5 self-assessment / correctness score fed into SM-2. See sm2.ts. */
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * A card proposed by the LLM-assisted generator (slice 2), NOT yet persisted.
 * Same type+payload shape as a real Card, plus a confidence score and a short
 * rationale so the student can judge whether to accept it. Always validated
 * with validateCardPayload() before it is ever shown to a user.
 */
export interface CardDraft {
  type: CardType;
  payload: CardPayload;
  /** 0-1, how confident the model claims to be that this card is well-formed/useful. */
  confidence: number;
  /** Short model-provided explanation of why this card was proposed. */
  rationale: string;
}

/** A user row enriched with how many sets they own, for the admin users list (slice 4). */
export interface UserWithSetCount extends User {
  setCount: number;
}

/** One row of the LLM cost/usage log (slice 2). Read by slice 4's admin analytics. */
export interface LlmCallLog {
  id: string;
  userId: string;
  requestedAt: Date;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  status: "success" | "error";
  errorMessage: string | null;
}

/**
 * One browser/device's Web Push subscription (slice 9). A user can have
 * several (multiple devices/browsers) — see pushSubscriptionRepoPort.ts.
 * `endpoint` is the push service URL the browser handed back from
 * `pushManager.subscribe()`; unique per browser+device registration, used as
 * the natural key for unsubscribe (see reminderUsecases.unsubscribeFromPush).
 */
export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  createdAt: Date;
}

/**
 * Slice 14 (live-quiz streak bonus): the durable "did the streak-bonus card
 * actually stick" record. Created (status='pending') the moment a live-round
 * streak crosses core/domain/liveQuiz.ts's STREAK_BONUS_THRESHOLD; resolved
 * to 'confirmed' (points count toward the lasting total) or 'forfeited'
 * (points never count) by the FIRST subsequent real review of the same
 * (userId, cardId) pair through reviewUsecases.submitReview — see
 * liveStreakBonusRepoPort.ts. This deliberately lives in real storage (not
 * in-memory room state): the round that created it may end long before the
 * player's next scheduled review of that card.
 */
export interface LiveStreakBonus {
  id: string;
  userId: string;
  cardId: string;
  roomCode: string;
  points: number;
  status: "pending" | "confirmed" | "forfeited";
  awardedAt: Date;
  resolvedAt: Date | null;
}
