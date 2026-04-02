import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter, writeRateLimiter } from "../middleware/rateLimiter";
import {
  handleList,
  handleCreate,
  handleUpdate,
  handleDelete,
} from "../controllers/feature-flags.controller";

const router = Router();
router.use(authenticate, tenantScope);

const adminOnly = requireRole("ADMINISTRATOR");
const analystOrAbove = requireRole("ADMINISTRATOR", "MODERATOR", "ANALYST");

// Read: analyst+ can see which flags exist
router.get("/admin/feature-flags", readRateLimiter, analystOrAbove, handleList);

// Writes: administrator only (config changes are audited)
router.post("/admin/feature-flags", writeRateLimiter, adminOnly, handleCreate);
router.patch("/admin/feature-flags/:key", writeRateLimiter, adminOnly, handleUpdate);
router.delete("/admin/feature-flags/:key", writeRateLimiter, adminOnly, handleDelete);

export default router;
