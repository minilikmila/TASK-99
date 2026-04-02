import { Router } from "express";
import { authenticate } from "../middleware/auth";
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

router.get("/threads/:threadId/replies", readRateLimiter, handleList);
router.post("/threads/:threadId/replies", writeRateLimiter, handleCreate);
router.patch("/replies/:replyId", writeRateLimiter, handleUpdate);
router.delete("/replies/:replyId", writeRateLimiter, handleDelete);

export default router;
