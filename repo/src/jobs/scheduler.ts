import cron from "node-cron";
import { execFile } from "child_process";
import path from "path";
import { logger } from "../lib/logger";
import {
  dispatchDueNotifications,
  retryFailedNotifications,
} from "../services/notification.service";
import { runRiskRules } from "../services/risk.service";
import { checkAlertThresholds } from "./log-alert";
import { adminRepository } from "../repositories/admin.repository";
import { prisma } from "../lib/prisma";
import { config } from "../config";

let started = false;

// ─── Maintenance helpers ──────────────────────────────────────────────────────

async function purgeExpiredRecycleBinItems(): Promise<void> {
  const now = new Date();

  // Find expired items with their content references before deleting
  const expired = await prisma.recycleBinItem.findMany({
    where: { expiresAt: { lt: now } },
    select: {
      id: true,
      organizationId: true,
      itemType: true,
      threadId: true,
      replyId: true,
    },
  });

  if (expired.length === 0) return;

  // Collect IDs of underlying content to hard-delete
  const threadIds = expired
    .filter((i) => i.itemType === "THREAD" && i.threadId)
    .map((i) => i.threadId!);
  const replyIds = expired
    .filter((i) => i.itemType === "REPLY" && i.replyId)
    .map((i) => i.replyId!);

  // Delete bin records first (they hold FK references to threads/replies)
  const binResult = await prisma.recycleBinItem.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Hard-delete the orphaned soft-deleted replies (before threads, due to FK)
  if (replyIds.length > 0) {
    await prisma.reply.deleteMany({ where: { id: { in: replyIds } } });
  }

  // Hard-delete the orphaned soft-deleted threads
  // First remove child replies of those threads, then the threads themselves
  if (threadIds.length > 0) {
    await prisma.reply.deleteMany({ where: { threadId: { in: threadIds } } });
    await prisma.threadTag.deleteMany({ where: { threadId: { in: threadIds } } });
    await prisma.thread.deleteMany({ where: { id: { in: threadIds } } });
  }

  logger.info("Purged expired recycle bin items and underlying content", {
    binItems: binResult.count,
    threads: threadIds.length,
    replies: replyIds.length,
  });
}

async function runRiskRulesForAllOrgs(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  await Promise.allSettled(
    orgs.map((org) =>
      runRiskRules(org.id).catch((err) =>
        logger.error("runRiskRules failed for org", {
          orgId: org.id,
          error: (err as Error).message,
        })
      )
    )
  );
}

async function runNightlyBackup(): Promise<void> {
  // Read retention days from DB config (first active org) with env fallback
  let retentionDays: number = config.backup.retentionDays;
  try {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 1,
    });
    if (orgs.length > 0) {
      const { getConfigValue, CONFIG_KEYS } = await import("../services/org-config.service");
      retentionDays = await getConfigValue(orgs[0].id, CONFIG_KEYS.BACKUP_RETENTION_DAYS);
    }
  } catch {
    // Fall back to config default
  }

  const scriptPath = path.resolve(__dirname, "../../scripts/backup.sh");
  const env = { ...process.env, BACKUP_RETENTION_DAYS: String(retentionDays) };
  execFile("bash", [scriptPath], { env }, (err, stdout, stderr) => {
    if (err) {
      logger.error("Nightly backup failed", { error: err.message, stderr });
    } else {
      logger.info("Nightly backup completed", { output: stdout.trim(), retentionDays });
    }
  });
}

async function deactivateExpiredContent(): Promise<void> {
  const now = new Date();

  const expiredAnnouncements = await adminRepository.findExpiredAnnouncements(now);
  for (const a of expiredAnnouncements) {
    await adminRepository.updateAnnouncement(a.id, { isPublished: false });
  }

  const expiredCarousel = await adminRepository.findExpiredCarouselItems(now);
  for (const c of expiredCarousel) {
    await adminRepository.updateCarouselItem(c.id, { isActive: false });
  }

  const total = expiredAnnouncements.length + expiredCarousel.length;
  if (total > 0) {
    logger.info("Deactivated expired content", {
      announcements: expiredAnnouncements.length,
      carouselItems: expiredCarousel.length,
    });
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function startScheduler(): void {
  if (started) return;
  started = true;

  // Every minute: dispatch pending notifications whose scheduledAt has passed
  cron.schedule("* * * * *", async () => {
    try {
      await dispatchDueNotifications();
    } catch (err) {
      logger.error("dispatchDueNotifications job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Every 5 minutes: retry failed notifications within the 24-hour window
  cron.schedule("*/5 * * * *", async () => {
    try {
      await retryFailedNotifications();
    } catch (err) {
      logger.error("retryFailedNotifications job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Every 15 minutes: run risk detection rules across all active orgs
  cron.schedule("*/15 * * * *", async () => {
    try {
      await runRiskRulesForAllOrgs();
    } catch (err) {
      logger.error("runRiskRules job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Every minute: check alert thresholds and emit warnings when exceeded
  cron.schedule("* * * * *", () => {
    try {
      checkAlertThresholds();
    } catch (err) {
      logger.error("checkAlertThresholds job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Daily at 02:00 UTC: purge expired recycle bin items
  cron.schedule("0 2 * * *", async () => {
    try {
      await purgeExpiredRecycleBinItems();
    } catch (err) {
      logger.error("purgeExpiredRecycleBinItems job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Every 5 minutes: deactivate announcements/carousel items past their endAt
  cron.schedule("*/5 * * * *", async () => {
    try {
      await deactivateExpiredContent();
    } catch (err) {
      logger.error("deactivateExpiredContent job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Every hour: purge expired revoked tokens
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await prisma.revokedToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info("Purged expired revoked tokens", { count: result.count });
      }
    } catch (err) {
      logger.error("purgeExpiredRevokedTokens job failed", {
        error: (err as Error).message,
      });
    }
  });

  // Daily at 02:30 UTC: nightly database backup with 14-day retention
  cron.schedule("30 2 * * *", () => {
    try {
      runNightlyBackup();
    } catch (err) {
      logger.error("runNightlyBackup job failed", {
        error: (err as Error).message,
      });
    }
  });

  logger.info("Background scheduler started", {
    jobs: [
      "dispatchNotifications (every 1 min)",
      "retryNotifications (every 5 min)",
      "alertThresholds (every 1 min)",
      "riskRules (every 15 min)",
      "recycleBinPurge (daily 02:00 UTC)",
      "deactivateExpiredContent (every 5 min)",
      "revokedTokenPurge (every 1 hour)",
      "nightlyBackup (daily 02:30 UTC)",
    ],
  });
}
