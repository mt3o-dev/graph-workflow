import webpush from "web-push";
import type { WebPushPort, PushSubscriptionKeys, WebPushSendResult } from "../../core/ports/webPushPort";

/**
 * Real Web Push delivery (slice 9), VAPID-signed via the `web-push` npm
 * library. See core/ports/webPushPort.ts for the seam this implements and
 * why (testing sendDueReminders without hitting a real push service).
 *
 * `vapidDetails` is set once per adapter instance rather than globally on
 * every call — `web-push`'s `setVapidDetails` is a module-level global, which
 * is fine here since this app only ever needs one VAPID identity, but is
 * called from the factory (not per-send) to make that single-call-site
 * explicit rather than accidentally repeated.
 */
export function createWebPushAdapter(vapidDetails: { subject: string; publicKey: string; privateKey: string }): WebPushPort {
  webpush.setVapidDetails(vapidDetails.subject, vapidDetails.publicKey, vapidDetails.privateKey);

  return {
    async send(subscription: PushSubscriptionKeys, payload: string): Promise<WebPushSendResult> {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
          },
          payload,
        );
        return { ok: true, expired: false };
      } catch (err) {
        // 404/410 is the standard web-push signal that this subscription is
        // gone (browser unsubscribed, uninstalled, etc.) and should be
        // deleted rather than retried — see reminderUsecases.sendDueReminders.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          return { ok: false, expired: true };
        }
        return { ok: false, expired: false };
      }
    },
  };
}
