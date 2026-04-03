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
import { getConfigValue, getRetryDelays, CONFIG_KEYS } from "./org-config.service";
import { prisma } from "../lib/prisma";

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
 * On failure, marks notification as FAILED with retry backoff from DB config.
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
      // Mark as FAILED so the retry worker picks it up with exponential backoff.
      // Do NOT increment retryCount here — the retry worker is the sole counter
      // to ensure "up to 3 retries" means 3 actual re-delivery attempts.
      try {
        const maxRetries = await getConfigValue(n.organizationId, CONFIG_KEYS.NOTIFICATION_MAX_RETRIES);
        if (n.retryCount >= maxRetries) {
          // All retries exhausted — mark as permanently failed (no nextRetryAt)
          await notificationRepository.markFailed(n.id, n.retryCount, null);
        } else {
          const delays = await getRetryDelays(n.organizationId);
          const delayMinutes = delays[n.retryCount] ?? delays.at(-1) ?? 1;
          const nextRetryAt = new Date(now.getTime() + delayMinutes * 60_000);
          await notificationRepository.markFailed(n.id, n.retryCount, nextRetryAt);
        }
      } catch (markErr) {
        logger.error("Failed to mark notification as FAILED", {
          notificationId: n.id,
          error: (markErr as Error).message,
        });
      }
    }
  }

  if (dispatched > 0) {
    logger.info("Notifications dispatched", { count: dispatched });
  }
  return dispatched;
}

/**
 * Re-queue FAILED notifications that are within the retry window.
 * Exponential backoff from DB config: default 1 min → 5 min → 30 min.
 * After maxRetries attempts the notification stays FAILED permanently.
 * Called by the scheduler every 5 minutes.
 */
export async function retryFailedNotifications(): Promise<number> {
  const now = new Date();

  // Get all active orgs to read per-org retry config
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let retried = 0;
  for (const org of orgs) {
    const maxRetries = await getConfigValue(org.id, CONFIG_KEYS.NOTIFICATION_MAX_RETRIES);
    const windowHours = await getConfigValue(org.id, CONFIG_KEYS.NOTIFICATION_RETRY_WINDOW_HOURS);
    const delays = await getRetryDelays(org.id);

    const windowStart = new Date(now.getTime() - windowHours * 3_600_000);
    const failed = await notificationRepository.findFailedForRetry(
      org.id,
      maxRetries,
      windowStart,
      now
    );

    for (const n of failed) {
      const newCount = n.retryCount + 1;
      const delayMinutes = delays[newCount - 1] ?? delays.at(-1) ?? 30;
      const nextRetryAt = new Date(now.getTime() + delayMinutes * 60_000);

      try {
        // Always re-queue for another dispatch attempt. The dispatch worker
        // will mark permanently FAILED if retryCount >= maxRetries after
        // the final delivery attempt fails.
        await notificationRepository.scheduleRetry(n.id, newCount, nextRetryAt);
        retried++;
      } catch (err) {
        logger.error("Retry update failed", {
          notificationId: n.id,
          error: (err as Error).message,
        });
      }
    }
  }

  if (retried > 0) {
    logger.info("Failed notifications retried", { count: retried });
  }
  return retried;
}
