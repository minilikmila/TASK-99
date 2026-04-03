import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

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

  // ─── Structured HTTP access logging with redaction ────────────────────────
  // Replaces morgan("combined") with structured fields routed through the
  // masking logger. Tokens, auth headers, IPs, and other PII are redacted.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      // Only log 4xx/5xx to reduce noise (same as previous morgan skip)
      if (res.statusCode >= 400) {
        logger.info("http_request", {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: duration,
          correlationId: req.correlationId,
          // These keys will be redacted by the maskFields format in logger.ts
          authorization: req.headers.authorization ?? undefined,
          ipAddress: req.ip ?? req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
          userId: req.user?.id,
        });
      }
    });
    next();
  });

  // ─── API routes (versioned at /api/v1) ───────────────────────────────────
  app.use("/api/v1", routes);

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
