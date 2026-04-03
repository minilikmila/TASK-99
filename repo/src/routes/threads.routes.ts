import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter, writeRateLimiter } from "../middleware/rateLimiter";
import {
  handleCreate,
  handleList,
  handleGet,
  handleUpdate,
  handleStateTransition,
  handlePin,
  handleUnpin,
  handleFeature,
  handleUnfeature,
  handleDelete,
  handleReport,
} from "../controllers/threads.controller";

const router = Router();
router.use(authenticate, tenantScope);

const modOrAdmin = requireRole("MODERATOR", "ADMINISTRATOR");
const canWrite = requireRole("ADMINISTRATOR", "MODERATOR", "USER");

router.get("/threads", readRateLimiter, handleList);
router.post("/threads", writeRateLimiter, canWrite, handleCreate);
router.get("/threads/:threadId", readRateLimiter, handleGet);
router.patch("/threads/:threadId", writeRateLimiter, canWrite, handleUpdate);
router.delete("/threads/:threadId", writeRateLimiter, canWrite, handleDelete);
router.post("/threads/:threadId/report", writeRateLimiter, canWrite, handleReport);

// State transitions and pin management require moderator or admin
router.post("/threads/:threadId/state", writeRateLimiter, modOrAdmin, handleStateTransition);
router.post("/threads/:threadId/pin", writeRateLimiter, modOrAdmin, handlePin);
router.post("/threads/:threadId/unpin", writeRateLimiter, modOrAdmin, handleUnpin);
router.post("/threads/:threadId/feature", writeRateLimiter, modOrAdmin, handleFeature);
router.post("/threads/:threadId/unfeature", writeRateLimiter, modOrAdmin, handleUnfeature);

export default router;
