import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { runRiskRules } from "../services/risk.service";

const runRiskRulesBody = z.object({
  organizationId: z.string().min(1).optional(),
});

/**
 * Internal trigger for risk rule evaluation (same logic as the scheduler job).
 * Used by API tests and operational tooling; not for browser clients.
 */
export async function handleRunRiskRules(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { organizationId } = runRiskRulesBody.parse(req.body ?? {});

    if (organizationId) {
      await runRiskRules(organizationId);
    } else {
      const orgs = await prisma.organization.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      await Promise.allSettled(orgs.map((org) => runRiskRules(org.id)));
    }

    res.json({ message: "Risk rules executed" });
  } catch (err) {
    next(err);
  }
}
