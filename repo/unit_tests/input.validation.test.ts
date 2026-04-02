/**
 * Unit tests for Zod schema input validation.
 * Tests error cases for all major request schemas with no server or DB access.
 */

import { z } from "zod";

// ─── Inline schemas (mirrors src/schemas/* exactly) ──────────────────────────

const loginSchema = z.object({
  organizationSlug: z.string().min(1, "Organization slug is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

const createThreadSchema = z.object({
  sectionId: z.string().min(1),
  subsectionId: z.string().min(1).optional(),
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  isFeatured: z.boolean().optional(),
});

const muteSchema = z.object({
  durationHours: z
    .number({ required_error: "durationHours is required" })
    .int()
    .min(24, "Minimum mute duration is 24 hours")
    .max(720, "Maximum mute duration is 720 hours"),
  reason: z.string().max(500).optional(),
});

const bulkContentSchema = z.object({
  action: z.enum(["archive_threads", "lock_threads", "delete_threads"]),
  threadIds: z
    .array(z.string().min(1))
    .min(1, "At least one thread required")
    .max(100, "Maximum 100 items per request"),
});

const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase snake_case"),
  value: z.boolean().default(false),
  description: z.string().max(500).optional(),
});

const changeRoleSchema = z.object({
  role: z.enum(["ADMINISTRATOR", "MODERATOR", "ANALYST", "USER"]),
});

const auditLogQuerySchema = z.object({
  actorId: z.string().optional(),
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  fromDate: z.string().datetime({ message: "fromDate must be ISO 8601 UTC" }).optional(),
  toDate: z.string().datetime({ message: "toDate must be ISO 8601 UTC" }).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? "1", 10) || 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "50", 10) || 50))),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseError(schema: z.ZodTypeAny, input: unknown): z.ZodError {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("Expected parse to fail but it succeeded");
  return result.error;
}

function issues(schema: z.ZodTypeAny, input: unknown): string {
  return parseError(schema, input).issues.map((i) => i.message).join("; ");
}

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  test("valid input passes", () => {
    const result = loginSchema.safeParse({
      organizationSlug: "my-org",
      username: "alice",
      password: "supersecretpass",
    });
    expect(result.success).toBe(true);
  });

  test("missing organizationSlug → error", () => {
    const err = issues(loginSchema, { username: "a", password: "longenoughpass" });
    expect(err).toMatch(/required/i);
  });

  test("empty organizationSlug → error", () => {
    const err = issues(loginSchema, {
      organizationSlug: "",
      username: "a",
      password: "longenoughpass",
    });
    expect(err).toMatch(/Organization slug is required/);
  });

  test("missing username → error", () => {
    const err = issues(loginSchema, {
      organizationSlug: "org",
      password: "longenoughpass",
    });
    expect(err).toMatch(/required/i);
  });

  test("empty username → error", () => {
    const err = issues(loginSchema, {
      organizationSlug: "org",
      username: "",
      password: "longenoughpass",
    });
    expect(err).toMatch(/Username is required/);
  });

  test("password shorter than 12 chars → error", () => {
    const err = issues(loginSchema, {
      organizationSlug: "org",
      username: "alice",
      password: "short",
    });
    expect(err).toMatch(/12 characters/);
  });

  test("password exactly 11 chars → error (boundary)", () => {
    const err = issues(loginSchema, {
      organizationSlug: "org",
      username: "alice",
      password: "11charpassw",
    });
    expect(err).toMatch(/12 characters/);
  });

  test("password exactly 12 chars → valid (boundary)", () => {
    const result = loginSchema.safeParse({
      organizationSlug: "org",
      username: "alice",
      password: "12charpasswo",
    });
    expect(result.success).toBe(true);
  });

  test("completely empty object → multiple errors", () => {
    const err = parseError(loginSchema, {});
    expect(err.issues.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── createThreadSchema ───────────────────────────────────────────────────────

describe("createThreadSchema", () => {
  const valid = {
    sectionId: "sec-1",
    title: "A valid title",
    body: "A valid body",
  };

  test("valid input passes", () => {
    expect(createThreadSchema.safeParse(valid).success).toBe(true);
  });

  test("missing sectionId → error", () => {
    const err = issues(createThreadSchema, { title: "t", body: "b" });
    expect(err).toBeTruthy();
  });

  test("empty sectionId → error", () => {
    const err = issues(createThreadSchema, { ...valid, sectionId: "" });
    expect(err).toBeTruthy();
  });

  test("missing title → error", () => {
    const err = issues(createThreadSchema, { sectionId: "s", body: "b" });
    expect(err).toBeTruthy();
  });

  test("empty title → error", () => {
    const err = issues(createThreadSchema, { ...valid, title: "" });
    expect(err).toBeTruthy();
  });

  test("title exceeding 500 chars → error", () => {
    const err = issues(createThreadSchema, { ...valid, title: "x".repeat(501) });
    expect(err).toBeTruthy();
  });

  test("title exactly 500 chars → valid (boundary)", () => {
    const result = createThreadSchema.safeParse({ ...valid, title: "x".repeat(500) });
    expect(result.success).toBe(true);
  });

  test("missing body → error", () => {
    const err = issues(createThreadSchema, { sectionId: "s", title: "t" });
    expect(err).toBeTruthy();
  });

  test("empty body → error", () => {
    const err = issues(createThreadSchema, { ...valid, body: "" });
    expect(err).toBeTruthy();
  });

  test("body exceeding 50 000 chars → error", () => {
    const err = issues(createThreadSchema, { ...valid, body: "x".repeat(50_001) });
    expect(err).toBeTruthy();
  });

  test("body exactly 50 000 chars → valid (boundary)", () => {
    const result = createThreadSchema.safeParse({ ...valid, body: "x".repeat(50_000) });
    expect(result.success).toBe(true);
  });

  test("tagIds with more than 20 entries → error", () => {
    const err = issues(createThreadSchema, {
      ...valid,
      tagIds: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    });
    expect(err).toBeTruthy();
  });

  test("tagIds with exactly 20 entries → valid (boundary)", () => {
    const result = createThreadSchema.safeParse({
      ...valid,
      tagIds: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
    });
    expect(result.success).toBe(true);
  });

  test("tagIds containing empty string → error", () => {
    const err = issues(createThreadSchema, { ...valid, tagIds: [""] });
    expect(err).toBeTruthy();
  });

  test("isFeatured as non-boolean string → error", () => {
    const err = issues(createThreadSchema, { ...valid, isFeatured: "yes" as unknown as boolean });
    expect(err).toBeTruthy();
  });
});

// ─── muteSchema ───────────────────────────────────────────────────────────────

describe("muteSchema", () => {
  test("24 hours → valid (minimum boundary)", () => {
    expect(muteSchema.safeParse({ durationHours: 24 }).success).toBe(true);
  });

  test("720 hours → valid (maximum boundary)", () => {
    expect(muteSchema.safeParse({ durationHours: 720 }).success).toBe(true);
  });

  test("48 hours with reason → valid", () => {
    expect(muteSchema.safeParse({ durationHours: 48, reason: "Spam" }).success).toBe(true);
  });

  test("23 hours → error (below minimum)", () => {
    const err = issues(muteSchema, { durationHours: 23 });
    expect(err).toMatch(/Minimum mute duration/);
  });

  test("0 hours → error", () => {
    const err = issues(muteSchema, { durationHours: 0 });
    expect(err).toMatch(/Minimum mute duration/);
  });

  test("721 hours → error (above maximum)", () => {
    const err = issues(muteSchema, { durationHours: 721 });
    expect(err).toMatch(/Maximum mute duration/);
  });

  test("1000 hours → error", () => {
    const err = issues(muteSchema, { durationHours: 1000 });
    expect(err).toMatch(/Maximum mute duration/);
  });

  test("non-integer (24.5) → error", () => {
    const err = issues(muteSchema, { durationHours: 24.5 });
    expect(err).toMatch(/int/i);
  });

  test("string instead of number → error", () => {
    const err = issues(muteSchema, { durationHours: "24" });
    expect(err).toBeTruthy();
  });

  test("missing durationHours → error", () => {
    const err = issues(muteSchema, {});
    expect(err).toMatch(/required/i);
  });

  test("reason exceeding 500 chars → error", () => {
    const err = issues(muteSchema, { durationHours: 24, reason: "x".repeat(501) });
    expect(err).toBeTruthy();
  });
});

// ─── bulkContentSchema ───────────────────────────────────────────────────────

describe("bulkContentSchema", () => {
  const validIds = ["id-1", "id-2"];

  test("lock_threads with valid ids → valid", () => {
    expect(
      bulkContentSchema.safeParse({ action: "lock_threads", threadIds: validIds }).success
    ).toBe(true);
  });

  test("archive_threads → valid", () => {
    expect(
      bulkContentSchema.safeParse({ action: "archive_threads", threadIds: validIds }).success
    ).toBe(true);
  });

  test("delete_threads → valid", () => {
    expect(
      bulkContentSchema.safeParse({ action: "delete_threads", threadIds: validIds }).success
    ).toBe(true);
  });

  test("unknown action → error", () => {
    const err = issues(bulkContentSchema, { action: "nuke_threads", threadIds: validIds });
    expect(err).toBeTruthy();
  });

  test("missing action → error", () => {
    const err = issues(bulkContentSchema, { threadIds: validIds });
    expect(err).toBeTruthy();
  });

  test("empty threadIds array → error", () => {
    const err = issues(bulkContentSchema, { action: "lock_threads", threadIds: [] });
    expect(err).toMatch(/At least one thread/);
  });

  test("threadIds with 100 items → valid (boundary)", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    expect(
      bulkContentSchema.safeParse({ action: "lock_threads", threadIds: ids }).success
    ).toBe(true);
  });

  test("threadIds with 101 items → error (above maximum)", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const err = issues(bulkContentSchema, { action: "lock_threads", threadIds: ids });
    expect(err).toMatch(/Maximum 100 items/);
  });

  test("threadIds containing empty string → error", () => {
    const err = issues(bulkContentSchema, { action: "lock_threads", threadIds: [""] });
    expect(err).toBeTruthy();
  });

  test("missing threadIds → error", () => {
    const err = issues(bulkContentSchema, { action: "lock_threads" });
    expect(err).toBeTruthy();
  });
});

// ─── createFeatureFlagSchema ──────────────────────────────────────────────────

describe("createFeatureFlagSchema", () => {
  test("valid key with underscores → valid", () => {
    expect(
      createFeatureFlagSchema.safeParse({ key: "my_feature_flag", value: false }).success
    ).toBe(true);
  });

  test("valid key with numbers → valid", () => {
    expect(
      createFeatureFlagSchema.safeParse({ key: "flag2024", value: true }).success
    ).toBe(true);
  });

  test("value defaults to false when omitted", () => {
    const result = createFeatureFlagSchema.safeParse({ key: "my_flag" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.value).toBe(false);
  });

  test("key starting with digit → error (must start with letter)", () => {
    const err = issues(createFeatureFlagSchema, { key: "2flag", value: false });
    expect(err).toMatch(/lowercase snake_case/);
  });

  test("key with uppercase letters → error", () => {
    const err = issues(createFeatureFlagSchema, { key: "MyFlag", value: false });
    expect(err).toMatch(/lowercase snake_case/);
  });

  test("key with hyphens → error (underscores only)", () => {
    const err = issues(createFeatureFlagSchema, { key: "my-flag", value: false });
    expect(err).toMatch(/lowercase snake_case/);
  });

  test("key with spaces → error", () => {
    const err = issues(createFeatureFlagSchema, { key: "my flag", value: false });
    expect(err).toMatch(/lowercase snake_case/);
  });

  test("empty key → error", () => {
    const err = issues(createFeatureFlagSchema, { key: "", value: false });
    expect(err).toBeTruthy();
  });

  test("key exceeding 100 chars → error", () => {
    const err = issues(createFeatureFlagSchema, { key: "a".repeat(101), value: false });
    expect(err).toBeTruthy();
  });

  test("value as string instead of boolean → error", () => {
    const err = issues(createFeatureFlagSchema, { key: "valid_key", value: "true" });
    expect(err).toBeTruthy();
  });

  test("description exceeding 500 chars → error", () => {
    const err = issues(createFeatureFlagSchema, {
      key: "valid_key",
      value: false,
      description: "x".repeat(501),
    });
    expect(err).toBeTruthy();
  });

  test("description exactly 500 chars → valid (boundary)", () => {
    const result = createFeatureFlagSchema.safeParse({
      key: "valid_key",
      value: false,
      description: "x".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

// ─── changeRoleSchema ─────────────────────────────────────────────────────────

describe("changeRoleSchema", () => {
  test.each(["ADMINISTRATOR", "MODERATOR", "ANALYST", "USER"])(
    "role '%s' → valid",
    (role) => {
      expect(changeRoleSchema.safeParse({ role }).success).toBe(true);
    }
  );

  test("unknown role 'SUPERUSER' → error", () => {
    const err = issues(changeRoleSchema, { role: "SUPERUSER" });
    expect(err).toBeTruthy();
  });

  test("lowercase role → error (must be uppercase enum)", () => {
    const err = issues(changeRoleSchema, { role: "administrator" });
    expect(err).toBeTruthy();
  });

  test("missing role → error", () => {
    const err = issues(changeRoleSchema, {});
    expect(err).toBeTruthy();
  });

  test("numeric role → error", () => {
    const err = issues(changeRoleSchema, { role: 1 });
    expect(err).toBeTruthy();
  });
});

// ─── auditLogQuerySchema ──────────────────────────────────────────────────────

describe("auditLogQuerySchema", () => {
  test("empty object → valid (all fields optional)", () => {
    expect(auditLogQuerySchema.safeParse({}).success).toBe(true);
  });

  test("valid ISO 8601 UTC fromDate → valid", () => {
    const result = auditLogQuerySchema.safeParse({
      fromDate: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("non-ISO fromDate → error", () => {
    const err = issues(auditLogQuerySchema, { fromDate: "January 1 2026" });
    expect(err).toMatch(/ISO 8601/i);
  });

  test("date-only string as fromDate → error (requires time component)", () => {
    const err = issues(auditLogQuerySchema, { fromDate: "2026-01-01" });
    expect(err).toMatch(/ISO 8601/i);
  });

  test("valid toDate → valid", () => {
    const result = auditLogQuerySchema.safeParse({
      toDate: "2026-12-31T23:59:59Z",
    });
    expect(result.success).toBe(true);
  });

  test("non-ISO toDate → error", () => {
    const err = issues(auditLogQuerySchema, { toDate: "not-a-date" });
    expect(err).toMatch(/ISO 8601/i);
  });

  test("page and pageSize as strings → transform to numbers", () => {
    const result = auditLogQuerySchema.safeParse({ page: "3", pageSize: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(25);
    }
  });

  test("pageSize clamped to 100 maximum", () => {
    const result = auditLogQuerySchema.safeParse({ pageSize: "999" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pageSize).toBe(100);
  });

  test("page clamped to minimum 1", () => {
    const result = auditLogQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });

  test("negative page clamped to 1", () => {
    const result = auditLogQuerySchema.safeParse({ page: "-5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });
});
