import { Router } from "express";
import { internalAuth } from "../middleware/internalAuth";
import {
  handleDispatchDue,
  handleRetryFailed,
} from "../controllers/notifications.controller";
import { handleRunRiskRules } from "../controllers/internal-jobs.controller";

const router = Router();

// Internal endpoints: protected by static API key, no user session.
// Mounted before any router that applies `authenticate` middleware globally.
router.post(
  "/internal/notifications/dispatch-due",
  internalAuth,
  handleDispatchDue
);
router.post(
  "/internal/notifications/retry-failed",
  internalAuth,
  handleRetryFailed
);
router.post("/internal/risk/run-rules", internalAuth, handleRunRiskRules);

export default router;
