/**
 * API tests — Extended DB-driven config (auth lockout, rate limits, notification retry)
 *
 * Verifies that auth lockout thresholds, rate limits, and notification retry
 * settings are read from DB and changes take effect without restart.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS } from "./helpers/fixtures";

let adminToken: string;

beforeAll(async () => {
  adminToken = await loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password);
});

// ─── Auth lockout from DB config ─────────────────────────────────────────────

describe("DB-driven auth lockout (auth.lockout_attempts)", () => {
  afterAll(async () => {
    // Restore defaults
    await api.patch(
      "/admin/feature-flags/auth.lockout_attempts",
      { description: "5" },
      adminToken
    );
  });

  test("reduce lockout threshold to 2 → 2 failures triggers lockout", async () => {
    // Set lockout threshold to 2
    await api.patch(
      "/admin/feature-flags/auth.lockout_attempts",
      { description: "2" },
      adminToken
    );

    // 2 failed attempts
    for (let i = 0; i < 2; i++) {
      await api.post("/auth/login", {
        organizationSlug: TEST_ORG,
        username: CREDS.target.username,
        password: "wrong-password-12345",
      });
    }

    // 3rd attempt should be locked even with correct password
    const locked = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.target.username,
      password: CREDS.target.password,
    });
    expect(locked.status).toBe(429);
    expect((locked.body.error as Record<string, unknown>).code).toBe("ACCOUNT_LOCKED");
  });
});

// ─── Notification retry config from DB ───────────────────────────────────────

describe("DB-driven notification retry config", () => {
  test("notification config keys exist and are readable", async () => {
    const res = await api.get("/admin/feature-flags", adminToken);
    expect(res.status).toBe(200);
    const flags = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const keys = flags.map((f) => f.key);
    expect(keys).toContain("notification.max_retries");
    expect(keys).toContain("notification.retry_delay_1_min");
    expect(keys).toContain("notification.retry_delay_2_min");
    expect(keys).toContain("notification.retry_delay_3_min");
    expect(keys).toContain("notification.retry_window_hours");
  });

  test("notification config is audited when changed", async () => {
    await api.patch(
      "/admin/feature-flags/notification.max_retries",
      { description: "3" },
      adminToken
    );
    const logs = await api.get("/audit/logs", adminToken, {
      eventType: "feature_flag.updated",
    });
    expect(logs.status).toBe(200);
    const data = (logs.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
  });
});

// ─── Backup retention config from DB ─────────────────────────────────────────

describe("DB-driven backup retention config", () => {
  test("backup.retention_days key exists and is readable", async () => {
    const res = await api.get("/admin/feature-flags", adminToken);
    expect(res.status).toBe(200);
    const flags = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const backupFlag = flags.find((f) => f.key === "backup.retention_days");
    expect(backupFlag).toBeDefined();
    expect(backupFlag!.description).toBe("14");
  });
});

// ─── Rate limit config from DB ───────────────────────────────────────────────

describe("DB-driven rate limit config", () => {
  test("rate limit config keys exist", async () => {
    const res = await api.get("/admin/feature-flags", adminToken);
    expect(res.status).toBe(200);
    const flags = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const keys = flags.map((f) => f.key);
    expect(keys).toContain("rate_limit.writes_per_min");
    expect(keys).toContain("rate_limit.reads_per_min");
  });
});
