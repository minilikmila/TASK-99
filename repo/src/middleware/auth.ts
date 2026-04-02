import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Role } from "@prisma/client"; // used in TokenPayload
import { config } from "../config";
import { AppError } from "./errorHandler";
import { ErrorCode, AuthenticatedUser } from "../types";
import { prisma } from "../lib/prisma";

interface TokenPayload {
  sub: string;
  organizationId: string;
  username: string;
  role: Role;
  isBanned: boolean;
  muteUntil: string | null;
  jti?: string;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return next(
        new AppError(401, ErrorCode.UNAUTHORIZED, "Bearer token required")
      );
    }

    const token = header.slice(7);
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
    } catch {
      return next(
        new AppError(401, ErrorCode.UNAUTHORIZED, "Invalid or expired token")
      );
    }

    if (payload.jti) {
      const revoked = await prisma.revokedToken.findUnique({
        where: { jti: payload.jti },
      });
      if (revoked) {
        return next(
          new AppError(401, ErrorCode.TOKEN_REVOKED, "Token has been revoked")
        );
      }
    }

    req.user = {
      id: payload.sub,
      organizationId: payload.organizationId,
      username: payload.username,
      role: payload.role,
      isBanned: payload.isBanned,
      muteUntil: payload.muteUntil ? new Date(payload.muteUntil) : null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Authentication required");
    }
    if (!roles.includes(req.user.role as string)) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        `Required role: ${roles.join(" or ")}`
      );
    }
    next();
  };
}

export function signToken(user: AuthenticatedUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    organizationId: user.organizationId,
    username: user.username,
    role: user.role,
    isBanned: user.isBanned,
    muteUntil: user.muteUntil?.toISOString() ?? null,
    jti: uuidv4(),
  };
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}
