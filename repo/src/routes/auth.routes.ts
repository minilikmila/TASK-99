import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { writeRateLimiter } from "../middleware/rateLimiter";
import { handleLogin, handleLogout, handleMe } from "../controllers/auth.controller";

const router = Router();

router.post("/auth/login", writeRateLimiter, handleLogin);
router.post("/auth/logout", authenticate, handleLogout);
router.get("/auth/me", authenticate, handleMe);

export default router;
