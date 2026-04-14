import winston from "winston";
import { config } from "../config";
import { maskIp, maskFields } from "./mask";

const maskSensitive = winston.format((info) => {
  Object.assign(info, maskFields(info as unknown as Record<string, unknown>));
  return info;
});

// ─── Logger ───────────────────────────────────────────────────────────────────

const useJsonLogs =
  config.env === "production" || config.env === "test";

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    maskSensitive(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    useJsonLogs
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, correlationId, ...meta }) => {
              const cid = correlationId ? ` [${correlationId}]` : "";
              const metaStr =
                Object.keys(meta).length > 0
                  ? ` ${JSON.stringify(meta)}`
                  : "";
              return `${timestamp} ${level}${cid}: ${message}${metaStr}`;
            }
          )
        )
  ),
  transports: [new winston.transports.Console()],
});

// Re-export masking utilities for backward compatibility
export { maskIp, maskFields };
