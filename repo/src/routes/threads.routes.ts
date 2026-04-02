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
  handleDelete,
} from "../controllers/threads.controller";

const router = Router();
router.use(authenticate, tenantScope);

const modOrAdmin = requireRole("MODERATOR", "ADMINISTRATOR");

router.get("/threads", readRateLimiter, handleList);
router.post("/threads", writeRateLimiter, handleCreate);
router.get("/threads/:threadId", readRateLimiter, handleGet);
router.patch("/threads/:threadId", writeRateLimiter, handleUpdate);
router.delete("/threads/:threadId", writeRateLimiter, handleDelete);

// State transitions and pin management require moderator or admin
router.post("/threads/:threadId/state", writeRateLimiter, modOrAdmin, handleStateTransition);
router.post("/threads/:threadId/pin", writeRateLimiter, modOrAdmin, handlePin);
router.post("/threads/:threadId/unpin", writeRateLimiter, modOrAdmin, handleUnpin);

export default router;
