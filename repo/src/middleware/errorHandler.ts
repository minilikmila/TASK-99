import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";
import { ApiErrorResponse, ErrorCode } from "../types";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorResponse = {
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
    correlationId: req.correlationId,
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      correlationId: req.correlationId,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Request validation failed",
        details: { issues: err.issues },
      },
      correlationId: req.correlationId,
    };
    res.status(400).json(body);
    return;
  }

  logger.error("Unhandled error", {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
  });

  const body: ApiErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    correlationId: req.correlationId,
  };
  res.status(500).json(body);
}
