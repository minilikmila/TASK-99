import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter } from "../middleware/rateLimiter";
import {
  handleFunnel,
  handleSummary,
  handleDailyBreakdown,
  handleTopThreads,
  handleActiveUsers,
} from "../controllers/analytics.controller";

const router = Router();
router.use(authenticate, tenantScope);

const analystOrAbove = requireRole("ADMINISTRATOR", "MODERATOR", "ANALYST");

router.get("/analytics/funnel",        readRateLimiter, analystOrAbove, handleFunnel);
router.get("/analytics/summary",       readRateLimiter, analystOrAbove, handleSummary);
router.get("/analytics/daily",         readRateLimiter, analystOrAbove, handleDailyBreakdown);
router.get("/analytics/top-threads",   readRateLimiter, analystOrAbove, handleTopThreads);
router.get("/analytics/active-users",  readRateLimiter, analystOrAbove, handleActiveUsers);

export default router;
