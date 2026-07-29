// Slice 9 (due-card reminders): client-side Web Push registration, loaded
// from the account settings page (src/pages/account/settings.astro). Mirrors
// the vanilla-DOM style of src/client/offline/sync.ts — no framework, this
// app doesn't ship one for client-side interactivity.
import { t } from "../../i18n";

const CONTAINER_ID = "push-reminders";

function locale(): "pl" | "en" {
  return document.documentElement.lang === "en" ? "en" : "pl";
}

// A VAPID public key arrives base64url-encoded (the format
// pushManager.subscribe's applicationServerKey needs as a Uint8Array), see
// https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function setStatus(el: HTMLElement, key: Parameters<typeof t>[0]): void {
  const status = el.querySelector<HTMLElement>("[data-push-status]");
  if (status) status.textContent = t(key, locale());
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function enable(el: HTMLElement, vapidPublicKey: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    setStatus(el, "settings.reminders.unsupported");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setStatus(el, "settings.reminders.permissionDenied");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dhKey: json.keys?.p256dh,
      authKey: json.keys?.auth,
    }),
  });

  if (!res.ok) {
    // Registered client-side but the server rejected it — undo the
    // client-side subscribe so state doesn't drift out of sync.
    await subscription.unsubscribe();
    setStatus(el, "settings.reminders.error");
    return;
  }

  render(el, true);
}

async function disable(el: HTMLElement): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) {
    render(el, false);
    return;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {
    // Best-effort — the client-side unsubscribe already happened, which is
    // what matters for this device; a stale server-side row (if this POST
    // failed) will still get cleaned up next time a push to it 404/410s
    // (see reminderUsecases.sendDueReminders).
  });

  render(el, false);
}

function render(el: HTMLElement, subscribed: boolean): void {
  const button = el.querySelector<HTMLButtonElement>("[data-push-toggle]");
  if (!button) return;
  button.textContent = subscribed ? t("settings.reminders.disable", locale()) : t("settings.reminders.enable", locale());
  button.dataset.subscribed = subscribed ? "1" : "0";
  setStatus(el, subscribed ? "settings.reminders.enabled" : "settings.reminders.disabled");
}

export async function initPushReminders(): Promise<void> {
  const el = document.getElementById(CONTAINER_ID);
  if (!el) return;
  const vapidPublicKey = el.dataset.vapidPublicKey;
  const button = el.querySelector<HTMLButtonElement>("[data-push-toggle]");
  if (!button || !vapidPublicKey) return;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setStatus(el, "settings.reminders.unsupported");
    button.disabled = true;
    return;
  }

  const existing = await currentSubscription();
  render(el, !!existing);
  button.disabled = false;

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (button.dataset.subscribed === "1") {
        await disable(el);
      } else {
        await enable(el, vapidPublicKey);
      }
    } finally {
      button.disabled = false;
    }
  });
}
