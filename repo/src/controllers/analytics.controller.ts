import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { analyticsService, EVENT } from "../services/analytics.service";

const periodSchema = z
  .object({
    from: z.string().datetime({ message: "from must be ISO 8601 UTC" }),
    to: z.string().datetime({ message: "to must be ISO 8601 UTC" }),
  })
  .refine((d) => new Date(d.from) < new Date(d.to), {
    message: "to must be after from",
    path: ["to"],
  });

export async function handleFunnel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const result = await analyticsService.getFunnelMetrics(
      req.user!.organizationId,
      new Date(from),
      new Date(to)
    );
    res.json({ period: { from, to }, funnel: result });
  } catch (err) {
    next(err);
  }
}

export async function handleSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const result = await analyticsService.getSummary(
      req.user!.organizationId,
      new Date(from),
      new Date(to)
    );
    res.json({ period: { from, to }, ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleDailyBreakdown(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        eventType: z
          .enum([
            EVENT.THREAD_VIEW,
            EVENT.POST_CREATED,
            EVENT.ENGAGEMENT,
            EVENT.USER_REGISTERED,
          ])
          .default(EVENT.THREAD_VIEW),
      })
      .refine((d) => new Date(d.from) < new Date(d.to), {
        message: "to must be after from",
        path: ["to"],
      })
      .parse(req.query);

    const data = await analyticsService.getDailyBreakdown(
      req.user!.organizationId,
      query.eventType,
      new Date(query.from),
      new Date(query.to)
    );
    res.json({ period: { from: query.from, to: query.to }, eventType: query.eventType, data });
  } catch (err) {
    next(err);
  }
}

export async function handleTopThreads(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        limit: z
          .string()
          .optional()
          .transform((v) => Math.min(50, Math.max(1, parseInt(v ?? "10", 10) || 10))),
      })
      .refine((d) => new Date(d.from) < new Date(d.to), {
        message: "to must be after from",
        path: ["to"],
      })
      .parse(req.query);

    const data = await analyticsService.getTopThreads(
      req.user!.organizationId,
      new Date(query.from),
      new Date(query.to),
      query.limit
    );
    res.json({ period: { from: query.from, to: query.to }, data });
  } catch (err) {
    next(err);
  }
}

export async function handleActiveUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { from, to } = periodSchema.parse(req.query);
    const count = await analyticsService.getActiveUserCount(
      req.user!.organizationId,
      new Date(from),
      new Date(to)
    );
    res.json({ period: { from, to }, activeUsers: count });
  } catch (err) {
    next(err);
  }
}
