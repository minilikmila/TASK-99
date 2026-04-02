import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";

import { correlationIdMiddleware } from "./middleware/correlationId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";
import { logger } from "./lib/logger";

export function createApp(): express.Application {
  const app = express();

  // ─── Security headers ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: false })); // Offline-first: no cross-origin allowed

  // ─── Body parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // ─── Compression ─────────────────────────────────────────────────────────
  app.use(compression());

  // ─── Correlation ID (tracing) ─────────────────────────────────────────────
  app.use(correlationIdMiddleware);

  // ─── HTTP request logging ────────────────────────────────────────────────
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
      skip: (_req, res) => res.statusCode < 400,
    })
  );

  // ─── API routes (versioned at /api/v1) ───────────────────────────────────
  app.use("/api/v1", routes);

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
