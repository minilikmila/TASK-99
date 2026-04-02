import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { writeRateLimiter, readRateLimiter } from "../middleware/rateLimiter";
import {
  handleBan,
  handleUnban,
  handleMute,
  handleUnmute,
  handleBulkContent,
  handleRecycleBinList,
  handleRestore,
  handlePurge,
  handleListFlags,
  handleUpdateFlag,
  handleListAuditLogs,
  handleChangeRole,
} from "../controllers/moderation.controller";

const router = Router();
router.use(authenticate, tenantScope);

const modOrAdmin = requireRole("MODERATOR", "ADMINISTRATOR");
const privileged = requireRole("ADMINISTRATOR", "MODERATOR", "ANALYST");

// User moderation
router.post("/moderation/users/:userId/ban", writeRateLimiter, modOrAdmin, handleBan);
router.post("/moderation/users/:userId/unban", writeRateLimiter, modOrAdmin, handleUnban);
router.post("/moderation/users/:userId/mute", writeRateLimiter, modOrAdmin, handleMute);
router.post("/moderation/users/:userId/unmute", writeRateLimiter, modOrAdmin, handleUnmute);

// Permission change — administrator only (audited)
const adminOnly = requireRole("ADMINISTRATOR");
router.patch("/moderation/users/:userId/role", writeRateLimiter, adminOnly, handleChangeRole);

// Bulk content
router.post("/moderation/content/bulk", writeRateLimiter, modOrAdmin, handleBulkContent);

// Recycle bin
router.get("/moderation/recycle-bin", readRateLimiter, modOrAdmin, handleRecycleBinList);
router.post("/moderation/recycle-bin/:itemId/restore", writeRateLimiter, modOrAdmin, handleRestore);
router.delete("/moderation/recycle-bin/:itemId/purge", writeRateLimiter, modOrAdmin, handlePurge);

// Risk flags
router.get("/risk/flags", readRateLimiter, modOrAdmin, handleListFlags);
router.patch("/risk/flags/:flagId", writeRateLimiter, modOrAdmin, handleUpdateFlag);

// Audit logs
router.get("/audit/logs", readRateLimiter, privileged, handleListAuditLogs);

export default router;
