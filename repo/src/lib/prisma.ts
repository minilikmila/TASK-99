import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

prisma.$on("error", (e) => {
  logger.error("Prisma error", { message: e.message, target: e.target });
});

prisma.$on("warn", (e) => {
  logger.warn("Prisma warning", { message: e.message, target: e.target });
});

// ─── Audit log immutability guard ───────────────────────────────────────────
// Reject any update or delete operation on the AuditLog model at the ORM level.
// This enforces append-only behavior beyond application-layer convention.
prisma.$use(async (params, next) => {
  if (params.model === "AuditLog") {
    const mutating = [
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
    ];
    if (mutating.includes(params.action)) {
      throw new Error(
        `AuditLog is append-only: ${params.action} operations are not permitted`
      );
    }
  }
  return next(params);
});

export { prisma };
