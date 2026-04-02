import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { readRateLimiter, writeRateLimiter } from "../middleware/rateLimiter";
import {
  handleListSections,
  handleCreateSection,
  handleUpdateSection,
  handleListSubsections,
  handleCreateSubsection,
} from "../controllers/sections.controller";

const router = Router();
router.use(authenticate, tenantScope);

router.get("/sections", readRateLimiter, handleListSections);
router.post("/sections", writeRateLimiter, handleCreateSection);
router.patch("/sections/:sectionId", writeRateLimiter, handleUpdateSection);

router.get("/sections/:sectionId/subsections", readRateLimiter, handleListSubsections);
router.post("/sections/:sectionId/subsections", writeRateLimiter, handleCreateSubsection);

export default router;
