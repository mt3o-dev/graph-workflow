// Pure domain types. Zero imports from adapters/*, astro:*, or any framework.

export type Role = "student" | "admin";
export type Locale = "pl" | "en";
export type Visibility = "private"; // slice 3 adds "unlisted" | "public"

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  banned: boolean;
  locale: Locale;
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
