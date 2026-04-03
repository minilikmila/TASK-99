import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter, writeRateLimiter } from "../middleware/rateLimiter";
import {
  handleCreate,
  handleList,
  handleUpdate,
  handleDelete,
} from "../controllers/replies.controller";

const router = Router();
router.use(authenticate, tenantScope);

const canWrite = requireRole("ADMINISTRATOR", "MODERATOR", "USER");

router.get("/threads/:threadId/replies", readRateLimiter, handleList);
router.post("/threads/:threadId/replies", writeRateLimiter, canWrite, handleCreate);
router.patch("/replies/:replyId", writeRateLimiter, canWrite, handleUpdate);
router.delete("/replies/:replyId", writeRateLimiter, canWrite, handleDelete);

export default router;
