import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter, writeRateLimiter } from "../middleware/rateLimiter";
import {
  handleListTags,
  handleCreateTag,
  handleUpdateTag,
  handleDeleteTag,
} from "../controllers/tags.controller";

const router = Router();
router.use(authenticate, tenantScope);

router.get("/tags", readRateLimiter, handleListTags);
router.post("/tags", writeRateLimiter, handleCreateTag);
router.patch("/tags/:tagId", writeRateLimiter, handleUpdateTag);
router.delete("/tags/:tagId", writeRateLimiter, handleDeleteTag);

export default router;
