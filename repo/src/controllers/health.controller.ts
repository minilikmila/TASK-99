import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export async function healthCheck(req: Request, res: Response): Promise<void> {
  let dbStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "degraded";
    logger.error("Health check: database unreachable", { error: String(err) });
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  res.status(dbStatus === "ok" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    services: {
      database: dbStatus,
    },
  });
}
