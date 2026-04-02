import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import sectionsRoutes from "./sections.routes";
import tagsRoutes from "./tags.routes";
import threadsRoutes from "./threads.routes";
import repliesRoutes from "./replies.routes";
import moderationRoutes from "./moderation.routes"; // includes audit + risk
import adminRoutes from "./admin.routes";
import featureFlagsRoutes from "./feature-flags.routes";
import notificationsRoutes from "./notifications.routes";
import analyticsRoutes from "./analytics.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(sectionsRoutes);
router.use(tagsRoutes);
router.use(threadsRoutes);
router.use(repliesRoutes);
router.use(moderationRoutes);
router.use(adminRoutes);
router.use(featureFlagsRoutes);
router.use(notificationsRoutes);
router.use(analyticsRoutes);

export default router;
