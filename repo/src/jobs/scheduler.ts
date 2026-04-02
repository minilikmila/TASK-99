import cron from "node-cron";
import { execFile } from "child_process";
import path from "path";
import { logger } from "../lib/logger";
import {
  dispatchDueNotifications,
  retryFailedNotifications,
} from "../services/notification.service";
import { runRiskRules } from "../services/risk.service";
import { prisma } from "../lib/prisma";
import { config } from "../config";

let started = false;

// ─── Maintenance helpers ──────────────────────────────────────────────────────

async function purgeExpiredRecycleBinItems(): Promise<void> {
  const now = new Date();
  const result = await prisma.recycleBinItem.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  if (result.count > 0) {
    logger.info("Purged expired recycle bin items", { count: result.count });
  }
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

function runNightlyBackup(): void {
  const scriptPath = path.resolve(__dirname, "../../scripts/backup.sh");
  execFile("bash", [scriptPath], (err, stdout, stderr) => {
    if (err) {
      logger.error("Nightly backup failed", { error: err.message, stderr });
    } else {
      logger.info("Nightly backup completed", { output: stdout.trim() });
    }
  });
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
      "riskRules (every 15 min)",
      "recycleBinPurge (daily 02:00 UTC)",
      "revokedTokenPurge (every 1 hour)",
      "nightlyBackup (daily 02:30 UTC)",
    ],
  });
}
