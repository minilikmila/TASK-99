/**
 * Notification service — in-app delivery ONLY.
 *
 * EXTERNAL CHANNELS EXPLICITLY DISABLED:
 *   - SMS: not implemented, no SMS provider configured
 *   - Email: not implemented, no email provider configured
 *   - WeChat / push: not implemented, no push provider configured
 *
 * All notifications are stored in the `notifications` table and delivered
 * when the user next polls GET /api/v1/notifications.
 */

import { config } from "../config";
import { logger } from "../lib/logger";
import { notificationRepository } from "../repositories/notification.repository";

// ─── Notification categories ──────────────────────────────────────────────────

export const CATEGORY = {
  REPLY: "reply",
  MODERATION: "moderation",
  ANNOUNCEMENT: "announcement",
  SECURITY: "security",
} as const;

// ─── Internal: create one notification for a user (subscription-aware) ────────

async function createNotification(params: {
  organizationId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  scheduledAt?: Date;
}): Promise<void> {
  const { scheduledAt = new Date(), ...rest } = params;

  // Security notices bypass subscription opt-out (default opt-in, cannot disable)
  if (rest.category !== CATEGORY.SECURITY) {
    const sub = await notificationRepository.getSubscription(
      rest.userId,
      rest.category
    );
    // Explicit opt-out recorded → skip
    if (sub && !sub.isOptIn) return;
  }

  await notificationRepository.create({ ...rest, scheduledAt });
}

// ─── Event triggers ───────────────────────────────────────────────────────────

/**
 * Notify the thread author when someone replies to their thread.
 * The replying user does NOT receive a self-notification.
 */
export async function notifyNewReply(
  threadId: string,
  organizationId: string,
  replyAuthorId: string,
  bodyPreview: string
): Promise<void> {
  try {
    const threadAuthorId = await notificationRepository.findThreadAuthorId(
      threadId,
      organizationId
    );
    if (!threadAuthorId || threadAuthorId === replyAuthorId) return;

    await createNotification({
      organizationId,
      userId: threadAuthorId,
      category: CATEGORY.REPLY,
      title: "New reply on your thread",
      body: bodyPreview.slice(0, 200),
    });
  } catch (err) {
    // Notification failures must never break the primary operation
    logger.error("notifyNewReply failed", { threadId, error: (err as Error).message });
  }
}

/**
 * Notify a user who has been banned or muted (security category — cannot opt out).
 */
export async function notifyModerationAction(
  targetUserId: string,
  organizationId: string,
  action: "banned" | "unbanned" | "muted" | "unmuted",
  details: { reason?: string; muteUntil?: string }
): Promise<void> {
  try {
    const titles: Record<typeof action, string> = {
      banned: "Your account has been suspended",
      unbanned: "Your account suspension has been lifted",
      muted: "You have been muted",
      unmuted: "Your mute has been lifted",
    };

    let body = titles[action];
    if (action === "muted" && details.muteUntil) {
      body += ` until ${details.muteUntil}`;
    }
    if (details.reason) {
      body += `. Reason: ${details.reason}`;
    }

    await createNotification({
      organizationId,
      userId: targetUserId,
      category: CATEGORY.SECURITY, // Always delivered — security category
      title: titles[action],
      body,
    });
  } catch (err) {
    logger.error("notifyModerationAction failed", {
      targetUserId,
      action,
      error: (err as Error).message,
    });
  }
}

/**
 * Fan out an announcement notification to all active users in the org.
 * Uses ANNOUNCEMENT category — users may opt out.
 */
export async function notifyAnnouncementPublished(
  organizationId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const userIds = await notificationRepository.findOrgUserIds(organizationId);

    // Fan out one notification per user (fire-and-forget, log errors per user)
    await Promise.allSettled(
      userIds.map((userId) =>
        createNotification({
          organizationId,
          userId,
          category: CATEGORY.ANNOUNCEMENT,
          title,
          body: body.slice(0, 500),
        })
      )
    );
  } catch (err) {
    logger.error("notifyAnnouncementPublished failed", {
      organizationId,
      error: (err as Error).message,
    });
  }
}

// ─── Scheduled jobs ───────────────────────────────────────────────────────────

/**
 * Mark all due PENDING notifications as DELIVERED.
 * Called by the scheduler every minute.
 */
export async function dispatchDueNotifications(): Promise<number> {
  const now = new Date();
  const due = await notificationRepository.findDueForDispatch(now);

  let dispatched = 0;
  for (const n of due) {
    try {
      await notificationRepository.markDelivered(n.id, now);
      dispatched++;
    } catch (err) {
      logger.error("Failed to deliver notification", {
        notificationId: n.id,
        error: (err as Error).message,
      });
    }
  }

  if (dispatched > 0) {
    logger.info("Notifications dispatched", { count: dispatched });
  }
  return dispatched;
}

/**
 * Re-queue FAILED notifications that are within the retry window.
 * Exponential backoff: delays are taken from config.notifications.retryDelaysMinutes.
 * After maxRetries attempts the notification is marked DELIVERED (best-effort).
 * Called by the scheduler every 5 minutes.
 */
export async function retryFailedNotifications(): Promise<number> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - config.notifications.retryWindowHours * 3_600_000
  );

  const failed = await notificationRepository.findFailedForRetry(
    config.notifications.maxRetries,
    windowStart,
    now
  );

  let retried = 0;
  for (const n of failed) {
    const newCount = n.retryCount + 1;
    const delayMinutes =
      config.notifications.retryDelaysMinutes[newCount - 1] ??
      config.notifications.retryDelaysMinutes.at(-1) ??
      30;
    const nextRetryAt = new Date(now.getTime() + delayMinutes * 60_000);

    try {
      if (newCount >= config.notifications.maxRetries) {
        // Final attempt exhausted — mark delivered (best-effort in-app)
        await notificationRepository.markDelivered(n.id, now);
      } else {
        await notificationRepository.scheduleRetry(n.id, newCount, nextRetryAt);
      }
      retried++;
    } catch (err) {
      logger.error("Retry update failed", {
        notificationId: n.id,
        error: (err as Error).message,
      });
    }
  }

  if (retried > 0) {
    logger.info("Failed notifications retried", { count: retried });
  }
  return retried;
}
