import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { ErrorCode } from "../types";

/**
 * Ensures that a tenant context (organizationId) is present on every
 * authenticated request.  The organizationId comes from the JWT payload,
 * so this runs after the `authenticate` middleware.
 */
export function tenantScope(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user?.organizationId) {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Tenant context could not be resolved"
    );
  }
  next();
}
