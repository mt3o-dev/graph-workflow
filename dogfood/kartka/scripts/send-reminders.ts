#!/usr/bin/env bun
// Slice 9 (due-card reminders): standalone cron entrypoint. This app has NO
// in-process scheduler (it's request/response SSR, nothing long-running) —
// see docs/RUNNING.md for the "invoke this periodically via an external
// cron" instructions. Uses the same composition root (getContainer()) as
// every Astro page, so this exercises the exact same repos/schedulers the
// live app uses — no separate DB connection logic to keep in sync.
import { getContainer } from "../src/di/container";
import { sendDueReminders } from "../src/core/usecases/reminderUsecases";
import { t } from "../src/i18n";
import type { User } from "../src/core/domain/types";

function buildPayload(dueCardCount: number, user: User): string {
  const locale = user.locale;
  return JSON.stringify({
    title: t("app.name", locale),
    body: t("reminders.notification.body", locale, { count: dueCardCount }),
    url: "/review",
  });
}

async function main(): Promise<void> {
  const { userRepo, cardRepo, scheduler, fsrsScheduler, pushSubscriptionRepo, webPush } = await getContainer();

  const result = await sendDueReminders({
    userRepo,
    cardRepo,
    schedulers: { sm2: scheduler, fsrs: fsrsScheduler },
    pushSubscriptionRepo,
    webPush,
    buildPayload,
  });

  // eslint-disable-next-line no-console
  console.log(
    `send-reminders: notified ${result.notifiedUsers} user(s), sent ${result.sentNotifications} notification(s), removed ${result.removedSubscriptions} expired subscription(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("send-reminders: failed", err);
    process.exit(1);
  });
