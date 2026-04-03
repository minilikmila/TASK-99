import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { writeRateLimiter } from "../middleware/rateLimiter";
import { handleLogin, handleLogout, handleMe, handleProvisionUser } from "../controllers/auth.controller";

const router = Router();

router.post("/auth/login", writeRateLimiter, handleLogin);
router.post("/auth/logout", authenticate, handleLogout);
router.get("/auth/me", authenticate, handleMe);

// User provisioning — administrator only
router.post(
  "/auth/users",
  authenticate,
  tenantScope,
  writeRateLimiter,
  requireRole("ADMINISTRATOR"),
  handleProvisionUser
);

export default router;
