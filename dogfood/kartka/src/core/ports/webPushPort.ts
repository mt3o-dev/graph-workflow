/** Keys needed to address one push subscription — the shape reminderUsecases needs, decoupled from the DB row's other fields. */
export interface PushSubscriptionKeys {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

export interface WebPushSendResult {
  ok: boolean;
  /**
   * True when the push service reported the subscription is gone (HTTP
   * 404/410) — the standard web-push signal that it should be deleted
   * rather than retried. See reminderUsecases.sendDueReminders.
   */
  expired: boolean;
}

/**
 * Seam around the `web-push` npm library (VAPID-signed delivery) so
 * reminderUsecases.sendDueReminders is testable without a real push service
 * — see adapters/push/webPushAdapter.ts for the real implementation and
 * tests/reminderUsecases.test.ts for a fake that returns `expired: true`.
 */
export interface WebPushPort {
  send(subscription: PushSubscriptionKeys, payload: string): Promise<WebPushSendResult>;
}
