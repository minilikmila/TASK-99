import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { ErrorCode } from "../types";

/**
 * Guards internal-only endpoints (e.g. notification dispatch jobs).
 * In production the INTERNAL_API_KEY env var must be set.
 * When unset the middleware rejects all requests to force explicit configuration.
 */
export function internalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Internal API key not configured on this instance"
    );
  }

  const provided = req.headers["x-internal-key"];
  if (provided !== key) {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Invalid internal API key"
    );
  }

  next();
}
