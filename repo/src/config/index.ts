const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

const optionalNum = (key: string, fallback: number): number => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
};

export const config = {
  env: optional("NODE_ENV", "development"),
  port: optionalNum("PORT", 3000),

  database: {
    url: required("DATABASE_URL"),
  },

  auth: {
    jwtSecret: optional("JWT_SECRET", "dev-secret-change-me"),
    jwtExpiresIn: optional("JWT_EXPIRES_IN", "8h"),
    lockoutAttempts: optionalNum("LOGIN_LOCKOUT_ATTEMPTS", 5),
    lockoutWindowMinutes: optionalNum("LOGIN_LOCKOUT_WINDOW_MINUTES", 15),
  },

  rateLimit: {
    writesPerMin: optionalNum("RATE_LIMIT_WRITE_PER_MIN", 120),
    readsPerMin: optionalNum("RATE_LIMIT_READ_PER_MIN", 600),
  },

  logging: {
    level: optional("LOG_LEVEL", "info"),
  },

  forum: {
    maxPinnedPerSection: 3,
    maxReplyDepth: 3,
    recycleBinRetentionDays: 30,
    bulkActionMaxItems: 100,
    muteDurationMinHours: 24,
    muteDurationMaxDays: 30,
  },

  notifications: {
    maxRetries: 3,
    retryDelaysMinutes: [1, 5, 30],
    retryWindowHours: 24,
  },

  backup: {
    retentionDays: 14,
    volumePath: optional("BACKUP_VOLUME_PATH", "/backups"),
  },
} as const;
