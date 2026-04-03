import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { notificationRepository } from "../repositories/notification.repository";
import {
  dispatchDueNotifications,
  retryFailedNotifications,
  CATEGORY,
} from "../services/notification.service";

export async function handleListNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await notificationRepository.findByUser(
      req.user!.id,
      req.user!.organizationId
    );
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function handleOpenNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await notificationRepository.markOpened(
      req.params.notificationId,
      req.user!.id,
      new Date()
    );
    res.json({ message: "Marked as opened" });
  } catch (err) {
    next(err);
  }
}

export async function handleGetSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subs = await notificationRepository.getSubscriptionsForUser(req.user!.id);
    res.json({ data: subs });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { subscriptions } = z
      .object({
        subscriptions: z.array(
          z.object({ category: z.string(), isOptIn: z.boolean() })
        ),
      })
      .parse(req.body);

    for (const sub of subscriptions) {
      // Security notices cannot be disabled
      if (sub.category === CATEGORY.SECURITY) continue;

      await notificationRepository.upsertSubscription(
        req.user!.id,
        req.user!.organizationId,
        sub.category,
        sub.isOptIn
      );
    }

    res.json({ message: "Subscriptions updated" });
  } catch (err) {
    next(err);
  }
}

// Internal endpoints (guarded by internalAuth middleware)

export async function handleDispatchDue(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const count = await dispatchDueNotifications();
    res.json({ dispatched: count });
  } catch (err) {
    next(err);
  }
}

export async function handleRetryFailed(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const count = await retryFailedNotifications();
    res.json({ retried: count });
  } catch (err) {
    next(err);
  }
}
