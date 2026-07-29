import type { PushSubscription } from "../domain/types";

export interface CreatePushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

export interface PushSubscriptionRepoPort {
  /**
   * Creates or (if this exact endpoint already exists for this same user —
   * e.g. the browser re-subscribed after a permission re-grant) replaces the
   * keys on the existing row. Always scoped to `input.userId`, which callers
   * must set to the *requesting* user's own id — see
   * reminderUsecases.subscribeToPush.
   */
  upsert(input: CreatePushSubscriptionInput): Promise<PushSubscription>;
  /** All subscriptions for one user (multiple devices/browsers). */
  listByUser(userId: string): Promise<PushSubscription[]>;
  /** Every subscription across every user — feeds scripts/send-reminders.ts, grouped by userId there. */
  listAll(): Promise<PushSubscription[]>;
  /**
   * Deletes a subscription iff it belongs to `userId` AND matches `endpoint`
   * exactly — the ownership check the unsubscribe endpoint relies on so a
   * user can never remove another user's subscription by guessing/supplying
   * their endpoint. Returns whether a row was actually deleted.
   */
  deleteByUserAndEndpoint(userId: string, endpoint: string): Promise<boolean>;
  /**
   * Deletes by endpoint only, no user scoping — used exclusively by the
   * reminder-sending cleanup path (scripts/send-reminders.ts /
   * reminderUsecases.sendDueReminders) when a push service reports 404/410
   * for that endpoint (the standard "this subscription is dead" signal).
   * Never reachable from an HTTP request body, so it isn't an ownership
   * bypass — see docs/architecture.md's boundary note if that assumption
   * ever changes.
   */
  deleteByEndpoint(endpoint: string): Promise<void>;
}
