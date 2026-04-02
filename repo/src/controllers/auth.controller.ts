import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { loginSchema } from "../schemas/auth.schema";
import { login } from "../services/auth.service";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import { prisma } from "../lib/prisma";

export async function handleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const ipAddress =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress;

    const result = await login({ ...input, ipAddress });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleLogout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded?.exp) {
        await prisma.revokedToken.create({
          data: {
            jti: decoded.jti,
            expiresAt: new Date(decoded.exp * 1000),
          },
        });
      }
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

export async function handleMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userRepository.findByIdInOrg(req.user!.id, req.user!.organizationId);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
    }

    // Never return passwordHash
    const { passwordHash: _pw, ...safe } = user;
    res.status(200).json(safe);
  } catch (err) {
    next(err);
  }
}
