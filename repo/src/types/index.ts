import { Role } from "@prisma/client";

// ─── Augment Express Request ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  username: string;
  role: Role;
  isBanned: boolean;
  muteUntil: Date | null;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
  correlationId: string;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── Common Error Codes ───────────────────────────────────────────────────────

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  THREAD_LOCKED: "THREAD_LOCKED",
  THREAD_ARCHIVED: "THREAD_ARCHIVED",
  REPLY_DEPTH_EXCEEDED: "REPLY_DEPTH_EXCEEDED",
  PIN_LIMIT_REACHED: "PIN_LIMIT_REACHED",
  USER_MUTED: "USER_MUTED",
  USER_BANNED: "USER_BANNED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  DEPENDENCY_MISSING: "DEPENDENCY_MISSING",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  BULK_LIMIT_EXCEEDED: "BULK_LIMIT_EXCEEDED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
