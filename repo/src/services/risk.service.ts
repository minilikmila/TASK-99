import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { featureFlagRepository } from "../repositories/feature-flag.repository";

/**
 * Rule-based risk detection — creates RiskFlag records for moderator review.
 * No automatic punitive actions are taken.
 *
 * Rules:
 *   HIGH_THREAD_DELETIONS  — actor deletes ≥N threads in W minutes (defaults: 10, 60)
 *   HIGH_CANCELLATIONS     — actor performs ≥N content deletions/undos in W minutes (defaults: 20, 60)
 *   HIGH_REPORT_VOLUME     — a thread receives ≥N reports in W minutes (defaults: 5, 30)
 *
 * Thresholds are read from FeatureFlag records (key stored in description field) so
 * they can be tuned per organisation without redeployment.
 */
export async function runRiskRules(organizationId: string): Promise<void> {
  const now = new Date();

  const [
    deletionThreshold,
    cancellationThreshold,
    reportThreshold,
    deletionWindowMins,
    reportWindowMins,
  ] = await Promise.all([
    getRiskThreshold(organizationId, "risk.deletion_threshold", 10),
    getRiskThreshold(organizationId, "risk.cancellation_threshold", 20),
    getRiskThreshold(organizationId, "risk.report_threshold", 5),
    getRiskThreshold(organizationId, "risk.deletion_window_minutes", 60),
    getRiskThreshold(organizationId, "risk.report_window_minutes", 30),
  ]);

  const deletionWindowAgo = new Date(now.getTime() - deletionWindowMins * 60_000);
  const reportWindowAgo = new Date(now.getTime() - reportWindowMins * 60_000);

  await Promise.all([
    checkHighThreadDeletions(organizationId, deletionWindowAgo, deletionThreshold),
    checkHighCancellations(organizationId, deletionWindowAgo, cancellationThreshold),
    checkHighReportVolume(organizationId, reportWindowAgo, reportThreshold),
  ]);
}

// ─── Rule: ≥N thread deletions in the deletion window ────────────────────────

async function checkHighThreadDeletions(
  organizationId: string,
  since: Date,
  threshold: number
): Promise<void> {
  const results = await prisma.auditLog.groupBy({
    by: ["actorId"],
    where: {
      organizationId,
      eventType: "thread.deleted",
      createdAt: { gte: since },
      actorId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gte: threshold } } },
  });

  for (const r of results) {
    if (!r.actorId) continue;
    await upsertFlag(
      organizationId,
      r.actorId,
      "User",
      "HIGH_THREAD_DELETIONS",
      { count: r._count.id, windowStart: since.toISOString(), threshold }
    );
  }
}

// ─── Rule: ≥N cancellations/undos in the deletion window ─────────────────────
// Counts reply.deleted + recycle_bin.restored events per actor.

async function checkHighCancellations(
  organizationId: string,
  since: Date,
  threshold: number
): Promise<void> {
  const results = await prisma.auditLog.groupBy({
    by: ["actorId"],
    where: {
      organizationId,
      eventType: { in: ["reply.deleted", "recycle_bin.restored"] },
      createdAt: { gte: since },
      actorId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gte: threshold } } },
  });

  for (const r of results) {
    if (!r.actorId) continue;
    await upsertFlag(
      organizationId,
      r.actorId,
      "User",
      "HIGH_CANCELLATIONS",
      { count: r._count.id, windowStart: since.toISOString(), threshold }
    );
  }
}

// ─── Rule: ≥N reports on a thread in the report window ───────────────────────

async function checkHighReportVolume(
  organizationId: string,
  since: Date,
  threshold: number
): Promise<void> {
  const results = await prisma.auditLog.groupBy({
    by: ["resourceId"],
    where: {
      organizationId,
      eventType: "thread.reported",
      createdAt: { gte: since },
      resourceId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gte: threshold } } },
  });

  for (const r of results) {
    if (!r.resourceId) continue;
    await upsertFlag(
      organizationId,
      r.resourceId,
      "Thread",
      "HIGH_REPORT_VOLUME",
      { count: r._count.id, windowStart: since.toISOString(), threshold }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRiskThreshold(
  organizationId: string,
  key: string,
  defaultValue: number
): Promise<number> {
  const flag = await featureFlagRepository.findByKey(organizationId, key);
  if (!flag?.description) return defaultValue;
  const n = parseInt(flag.description, 10);
  return isNaN(n) ? defaultValue : n;
}

async function upsertFlag(
  organizationId: string,
  subjectId: string,
  subjectType: string,
  rule: string,
  details: Record<string, unknown>
): Promise<void> {
  const existing = await prisma.riskFlag.findFirst({
    where: { organizationId, subjectId, rule, status: "OPEN" },
    select: { id: true },
  });

  if (existing) {
    await prisma.riskFlag.update({
      where: { id: existing.id },
      data: { details: details as Prisma.InputJsonValue },
    });
    return;
  }

  try {
    await prisma.riskFlag.create({
      data: {
        organizationId,
        subjectId,
        subjectType,
        rule,
        details: details as Prisma.InputJsonValue,
      },
    });
    logger.warn("Risk flag created", { organizationId, subjectId, rule });
  } catch (err) {
    logger.error("Risk flag creation failed", {
      subjectId,
      rule,
      error: (err as Error).message,
    });
  }
}
