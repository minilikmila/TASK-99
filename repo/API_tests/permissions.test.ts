/**
 * API tests — Cross-cutting permission and authentication checks
 *
 * Verifies that every protected endpoint enforces:
 *   1. Authentication (401 when no / invalid token)
 *   2. Role-based access control (403 when insufficient role)
 *
 * These tests complement the per-domain test files, which test success paths.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS, USER_IDS } from "./helpers/fixtures";

let userToken: string;       // USER role
let analystToken: string;    // ANALYST role
let modToken: string;        // MODERATOR role

const INVALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.invalid.signature";
const EXPIRED_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiJ4Iiwib3JnYW5pemF0aW9uSWQiOiJ4IiwidXNlcm5hbWUiOiJ4Iiwicm9sZSI6IlVTRVIiLCJpYXQiOjEsImV4cCI6MX0." +
  "fake_sig";

beforeAll(async () => {
  [userToken, analystToken, modToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.user1.username,  CREDS.user1.password),
    loginAs(TEST_ORG, CREDS.analyst.username, CREDS.analyst.password),
    loginAs(TEST_ORG, CREDS.mod.username,     CREDS.mod.password),
  ]);
});

// ─── Unauthenticated access (no token) ───────────────────────────────────────

describe("Unauthenticated requests (no token) → 401", () => {
  // Separate tables so jest-each always passes a consistent arity (avoids flaky hangs).
  const getPaths = [
    "/threads",
    "/sections",
    "/auth/me",
    "/moderation/recycle-bin",
    "/audit/logs",
    "/risk/flags",
    "/analytics/funnel",
    "/notifications",
  ];

  test.each(getPaths)("GET %s → 401", async (path) => {
    const res = await api.get(path);
    expect(res.status).toBe(401);
    expect((res.body.error as Record<string, unknown>)?.code).toBe("UNAUTHORIZED");
  });

  test("POST /threads → 401", async () => {
    const res = await api.post("/threads", {
      sectionId: "x",
      title: "x",
      body: "x",
    });
    expect(res.status).toBe(401);
    expect((res.body.error as Record<string, unknown>)?.code).toBe("UNAUTHORIZED");
  });
});

// ─── Invalid / expired token ──────────────────────────────────────────────────

describe("Invalid token → 401", () => {
  test("malformed JWT returns 401", async () => {
    const res = await api.get("/auth/me", INVALID_TOKEN);
    expect(res.status).toBe(401);
  });

  test("expired JWT returns 401", async () => {
    const res = await api.get("/auth/me", EXPIRED_TOKEN);
    expect(res.status).toBe(401);
  });

  test("random string as token returns 401", async () => {
    const res = await api.get("/threads", "just-a-random-string");
    expect(res.status).toBe(401);
  });
});

// ─── Insufficient role: USER ──────────────────────────────────────────────────

describe("USER role — forbidden on privileged endpoints (403)", () => {
  test("cannot change thread state", async () => {
    // Create a thread first
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Perm Test", body: "body" },
      userToken
    );
    const id = (t.body as Record<string, unknown>).id as string;

    const res = await api.post(`/threads/${id}/state`, { toState: "LOCKED" }, userToken);
    expect(res.status).toBe(403);
    expect((res.body.error as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("cannot pin a thread", async () => {
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Pin Perm Test", body: "body" },
      userToken
    );
    const id = (t.body as Record<string, unknown>).id as string;
    const res = await api.post(`/threads/${id}/pin`, undefined, userToken);
    expect(res.status).toBe(403);
  });

  test("cannot ban a user", async () => {
    const res = await api.post(`/moderation/users/${USER_IDS.user2}/ban`, undefined, userToken);
    expect(res.status).toBe(403);
  });

  test("cannot mute a user", async () => {
    const res = await api.post(
      `/moderation/users/${USER_IDS.user2}/mute`,
      { durationHours: 24 },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("cannot access recycle bin", async () => {
    const res = await api.get("/moderation/recycle-bin", userToken);
    expect(res.status).toBe(403);
  });

  test("cannot read audit logs", async () => {
    const res = await api.get("/audit/logs", userToken);
    expect(res.status).toBe(403);
  });

  test("cannot read risk flags", async () => {
    const res = await api.get("/risk/flags", userToken);
    expect(res.status).toBe(403);
  });

  test("cannot read analytics", async () => {
    const res = await api.get("/analytics/funnel", userToken, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
    });
    expect(res.status).toBe(403);
  });

  test("cannot create feature flags", async () => {
    const res = await api.post(
      "/admin/feature-flags",
      { key: "test_flag", value: false },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("cannot change another user's role", async () => {
    const res = await api.patch(
      `/moderation/users/${USER_IDS.user2}/role`,
      { role: "MODERATOR" },
      userToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── Insufficient role: ANALYST ──────────────────────────────────────────────

describe("ANALYST role — can read but not write privileged resources", () => {
  test("can read audit logs", async () => {
    const res = await api.get("/audit/logs", analystToken);
    expect(res.status).toBe(200);
  });

  test("can read analytics", async () => {
    const res = await api.get("/analytics/funnel", analystToken, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
    });
    expect(res.status).toBe(200);
  });

  test("can read feature flags", async () => {
    const res = await api.get("/admin/feature-flags", analystToken);
    expect(res.status).toBe(200);
  });

  test("cannot ban users", async () => {
    const res = await api.post(`/moderation/users/${USER_IDS.user2}/ban`, undefined, analystToken);
    expect(res.status).toBe(403);
  });

  test("cannot create feature flags", async () => {
    const res = await api.post(
      "/admin/feature-flags",
      { key: "analyst_flag", value: true },
      analystToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── Insufficient role: MODERATOR ────────────────────────────────────────────

describe("MODERATOR role — cannot change org-level config", () => {
  test("cannot create feature flags (admin only)", async () => {
    const res = await api.post(
      "/admin/feature-flags",
      { key: "mod_flag", value: false },
      modToken
    );
    expect(res.status).toBe(403);
  });

  test("cannot change user roles (admin only)", async () => {
    const res = await api.patch(
      `/moderation/users/${USER_IDS.user2}/role`,
      { role: "ADMINISTRATOR" },
      modToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── Bulk content actions — role enforcement ─────────────────────────────────

describe("Bulk content actions — role-based access control", () => {
  let bulkTestThread: string;

  beforeAll(async () => {
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Bulk Perm Test Thread", body: "body" },
      userToken
    );
    bulkTestThread = (t.body as Record<string, unknown>).id as string;
  });

  test("USER role cannot bulk lock threads (403)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [bulkTestThread] },
      userToken
    );
    expect(res.status).toBe(403);
    expect((res.body.error as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("ANALYST role cannot bulk lock threads (403)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [bulkTestThread] },
      analystToken
    );
    expect(res.status).toBe(403);
    expect((res.body.error as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("MODERATOR role can bulk lock threads (200)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [bulkTestThread] },
      modToken
    );
    expect(res.status).toBe(200);
    const results = (res.body as Record<string, unknown>).results as Array<Record<string, unknown>>;
    expect(Array.isArray(results)).toBe(true);
  });

  test("USER role cannot bulk archive threads (403)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "archive_threads", threadIds: [bulkTestThread] },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("ANALYST role cannot bulk archive threads (403)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "archive_threads", threadIds: [bulkTestThread] },
      analystToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── 404 for unknown routes ───────────────────────────────────────────────────

describe("Unknown routes", () => {
  test("returns 404 with NOT_FOUND code", async () => {
    const res = await api.get("/this-route-does-not-exist", userToken);
    expect(res.status).toBe(404);
    expect((res.body.error as Record<string, unknown>).code).toBe("NOT_FOUND");
  });
});
