// Slice 9 (due-card reminders) orchestration. Ownership rules (spelled out
// per function below) are the same class of thing flagged repeatedly in
// prior slices' reviews: a subscription always belongs to whoever is logged
// in at creation time, and unsubscribe only ever touches the requesting
// user's own rows.
import type { PushSubscriptionRepoPort } from "../ports/pushSubscriptionRepoPort";
import type { UserRepoPort } from "../ports/userRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { WebPushPort } from "../ports/webPushPort";
import type { PushSubscription, User } from "../domain/types";
import { ValidationError } from "../domain/errors";
import { selectUsersForDueReminders, type ReminderCandidate } from "../domain/reminderPlanner";
import { startReviewSession, type Schedulers } from "./reviewUsecases";

/**
 * Registers (or refreshes) one push subscription for `requestingUserId` —
 * always the authenticated user making the request, never a value read from
 * the request body. See pages/api/push/subscribe.ts.
 */
export async function subscribeToPush(
  pushSubscriptionRepo: PushSubscriptionRepoPort,
  requestingUserId: string,
  input: { endpoint: string; p256dhKey: string; authKey: string },
): Promise<PushSubscription> {
  if (!input.endpoint || !input.p256dhKey || !input.authKey) {
    throw new ValidationError("endpoint, p256dhKey, and authKey are all required");
  }
  return pushSubscriptionRepo.upsert({
    userId: requestingUserId,
    endpoint: input.endpoint,
    p256dhKey: input.p256dhKey,
    authKey: input.authKey,
  });
}

/**
 * Removes one push subscription, scoped to `requestingUserId`'s own rows
 * only — `deleteByUserAndEndpoint` deletes iff both the endpoint AND the
 * owning userId match, so a request supplying another user's endpoint (by
 * guessing or reuse) deletes nothing rather than that other user's
 * subscription. Returns whether anything was actually removed (so the route
 * can decide between a 200 and a 404, without ever leaking *whose*
 * subscription that endpoint might belong to).
 */
export async function unsubscribeFromPush(
  pushSubscriptionRepo: PushSubscriptionRepoPort,
  requestingUserId: string,
  endpoint: string,
): Promise<boolean> {
  if (!endpoint) throw new ValidationError("endpoint is required");
  return pushSubscriptionRepo.deleteByUserAndEndpoint(requestingUserId, endpoint);
}

export interface SendDueRemindersResult {
  notifiedUsers: number;
  sentNotifications: number;
  removedSubscriptions: number;
}

/**
 * Orchestrates one reminder-sending pass (invoked by scripts/send-reminders.ts,
 * itself invoked by an external cron — this app has no in-process
 * scheduler, see docs/RUNNING.md).
 *
 * Only considers users who have at least one push subscription (queries
 * pushSubscriptionRepo.listAll() once, groups by userId) rather than
 * scanning every user in the system — cheap at this app's scale and avoids
 * an unnecessary per-user due-count query for students who never opted in.
 *
 * For each such user: computes their real due-card count via the same
 * startReviewSession usecase the review page itself uses (so "cards due"
 * always means the same thing everywhere), then hands
 * {dueCardCount, quietHours, subscriptionCount} to the pure
 * selectUsersForDueReminders to decide who gets notified right now.
 *
 * Delivery: every subscription of every selected user gets one VAPID-signed
 * push (see WebPushPort / adapters/push/webPushAdapter.ts). A subscription
 * whose send comes back `expired` (404/410 — the push service's standard
 * "this registration is dead" signal) is deleted immediately so it stops
 * being retried on the next cron tick.
 */
export async function sendDueReminders(deps: {
  userRepo: UserRepoPort;
  cardRepo: CardRepoPort;
  schedulers: Schedulers;
  pushSubscriptionRepo: PushSubscriptionRepoPort;
  webPush: WebPushPort;
  buildPayload: (dueCardCount: number, user: User) => string;
  now?: Date;
}): Promise<SendDueRemindersResult> {
  const now = deps.now ?? new Date();

  const allSubscriptions = await deps.pushSubscriptionRepo.listAll();
  const subscriptionsByUser = new Map<string, PushSubscription[]>();
  for (const sub of allSubscriptions) {
    const bucket = subscriptionsByUser.get(sub.userId);
    if (bucket) bucket.push(sub);
    else subscriptionsByUser.set(sub.userId, [sub]);
  }

  const candidates: ReminderCandidate[] = [];
  const dueCounts = new Map<string, number>();
  const usersById = new Map<string, User>();
  for (const [userId, subs] of subscriptionsByUser) {
    const user = await deps.userRepo.findById(userId);
    if (!user || user.banned) continue;

    const due = await startReviewSession(deps.cardRepo, deps.schedulers, userId, user.schedulerPreference, now);
    dueCounts.set(userId, due.length);
    usersById.set(userId, user);
    candidates.push({
      userId,
      dueCardCount: due.length,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
      subscriptionCount: subs.length,
    });
  }

  const selectedUserIds = selectUsersForDueReminders(candidates, now);

  let sentNotifications = 0;
  let removedSubscriptions = 0;
  for (const userId of selectedUserIds) {
    const subs = subscriptionsByUser.get(userId) ?? [];
    const user = usersById.get(userId);
    if (!user) continue;
    const payload = deps.buildPayload(dueCounts.get(userId) ?? 0, user);
    for (const sub of subs) {
      const result = await deps.webPush.send(
        { endpoint: sub.endpoint, p256dhKey: sub.p256dhKey, authKey: sub.authKey },
        payload,
      );
      if (result.expired) {
        await deps.pushSubscriptionRepo.deleteByEndpoint(sub.endpoint);
        removedSubscriptions++;
        continue;
      }
      if (result.ok) sentNotifications++;
    }
  }

  return { notifiedUsers: selectedUserIds.length, sentNotifications, removedSubscriptions };
}
