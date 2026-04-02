/**
 * API tests — Moderation
 *
 * Covers: ban/unban (with login-state verification), mute/unmute (with
 * duration validation), bulk content actions, recycle bin, restore,
 * audit log access, and role-change endpoint.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, USER_IDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;

// IDs of threads for bulk/state tests
let bulkThread1: string;
let bulkThread2: string;
let bulkThread3: string;

beforeAll(async () => {
  [adminToken, modToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username,   CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);

  // Threads for bulk action tests
  const [b1, b2, b3] = await Promise.all([
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Bulk Thread A", body: "body" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Bulk Thread B", body: "body" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Bulk Thread C", body: "body" }, userToken),
  ]);
  bulkThread1 = (b1.body as Record<string, unknown>).id as string;
  bulkThread2 = (b2.body as Record<string, unknown>).id as string;
  bulkThread3 = (b3.body as Record<string, unknown>).id as string;
});

// ─── Ban / Unban ──────────────────────────────────────────────────────────────

describe("Ban / Unban — pre/post state verification", () => {
  const targetId = USER_IDS.target;

  afterEach(async () => {
    // Always unban between tests so the target user is in a known state
    await api.post(`/moderation/users/${targetId}/unban`, undefined, modToken);
  });

  test("pre: target can log in → ban → post: login returns 403", async () => {
    // Pre-state: can log in
    const preBefore = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.target.username,
      password: CREDS.target.password,
    });
    expect(preBefore.status).toBe(200);

    // Ban
    const ban = await api.post(`/moderation/users/${targetId}/ban`, undefined, modToken);
    expect(ban.status).toBe(200);
    expect((ban.body as Record<string, unknown>).isBanned).toBe(true);

    // Post-state: login blocked
    const postLogin = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.target.username,
      password: CREDS.target.password,
    });
    expect(postLogin.status).toBe(403);
    expect((postLogin.body.error as Record<string, unknown>).code).toBe("USER_BANNED");
  });

  test("ban then unban — login restored", async () => {
    await api.post(`/moderation/users/${targetId}/ban`, undefined, modToken);

    const unban = await api.post(`/moderation/users/${targetId}/unban`, undefined, modToken);
    expect(unban.status).toBe(200);
    expect((unban.body as Record<string, unknown>).isBanned).toBe(false);

    // Can log in again
    const login = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.target.username,
      password: CREDS.target.password,
    });
    expect(login.status).toBe(200);
  });

  test("permission — USER role cannot ban (403)", async () => {
    const res = await api.post(`/moderation/users/${targetId}/ban`, undefined, userToken);
    expect(res.status).toBe(403);
  });

  test("not found — banning nonexistent user returns 404", async () => {
    const res = await api.post("/moderation/users/nonexistent-id/ban", undefined, modToken);
    expect(res.status).toBe(404);
  });
});

// ─── Mute / Unmute ────────────────────────────────────────────────────────────

describe("Mute / Unmute", () => {
  const targetId = USER_IDS.target;

  afterEach(async () => {
    await api.post(`/moderation/users/${targetId}/unmute`, undefined, modToken);
  });

  test("success — mute with valid 24h duration returns muteUntil", async () => {
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 24 },
      modToken
    );
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.muteUntil).toBeTruthy();
    expect(new Date(body.muteUntil as string) > new Date()).toBe(true);
  });

  test("success — mute with reason", async () => {
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 48, reason: "Spam detected" },
      modToken
    );
    expect(res.status).toBe(200);
  });

  test("validation — duration below 24h returns 400", async () => {
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 23 },
      modToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("VALIDATION_ERROR");
  });

  test("validation — duration above 720h (30d) returns 400", async () => {
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 721 },
      modToken
    );
    expect(res.status).toBe(400);
  });

  test("validation — missing durationHours returns 400", async () => {
    const res = await api.post(`/moderation/users/${targetId}/mute`, {}, modToken);
    expect(res.status).toBe(400);
  });

  test("permission — USER role cannot mute (403)", async () => {
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 24 },
      userToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── Bulk content actions ─────────────────────────────────────────────────────

describe("POST /moderation/content/bulk", () => {
  test("success — lock multiple threads in one request", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [bulkThread1, bulkThread2] },
      modToken
    );
    expect(res.status).toBe(200);
    const results = (res.body as Record<string, unknown>).results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.status).toBe("ok"));

    // Post-state: threads are locked
    const [t1, t2] = await Promise.all([
      api.get(`/threads/${bulkThread1}`, modToken),
      api.get(`/threads/${bulkThread2}`, modToken),
    ]);
    expect((t1.body as Record<string, unknown>).state).toBe("LOCKED");
    expect((t2.body as Record<string, unknown>).state).toBe("LOCKED");
  });

  test("success — archive includes already-locked threads as skipped", async () => {
    // bulkThread1 and bulkThread2 are already LOCKED, bulkThread3 is ACTIVE
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "archive_threads", threadIds: [bulkThread1, bulkThread3] },
      modToken
    );
    expect(res.status).toBe(200);
    const results = (res.body as Record<string, unknown>).results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(2);
    // LOCKED → ARCHIVED is valid; both should succeed
    results.forEach((r) => expect(["ok", "skipped"]).toContain(r.status));
  });

  test("validation — exceeding 100 items returns 400", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `fake-id-${i}`);
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: ids },
      modToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("VALIDATION_ERROR");
  });

  test("validation — empty threadIds returns 400", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [] },
      modToken
    );
    expect(res.status).toBe(400);
  });

  test("validation — invalid action returns 400", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "nuke_threads", threadIds: [bulkThread3] },
      modToken
    );
    expect(res.status).toBe(400);
  });

  test("permission — USER role cannot bulk action (403)", async () => {
    const res = await api.post(
      "/moderation/content/bulk",
      { action: "lock_threads", threadIds: [bulkThread1] },
      userToken
    );
    expect(res.status).toBe(403);
  });
});

// ─── Recycle bin ─────────────────────────────────────────────────────────────

describe("Recycle bin", () => {
  let deletedThreadId: string;

  beforeAll(async () => {
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Recycle Bin Test Thread", body: "Will be deleted" },
      userToken
    );
    deletedThreadId = (t.body as Record<string, unknown>).id as string;
    await api.del(`/threads/${deletedThreadId}`, userToken);
  });

  test("GET /moderation/recycle-bin — returns deleted items", async () => {
    const res = await api.get("/moderation/recycle-bin", modToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((i) => i.threadId === deletedThreadId)).toBe(true);
  });

  test("restore — thread re-appears in GET after restore", async () => {
    const bin = await api.get("/moderation/recycle-bin", modToken);
    const items = (bin.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const item = items.find((i) => i.threadId === deletedThreadId);
    expect(item).toBeDefined();
    const itemId = item!.id as string;

    const restore = await api.post(`/moderation/recycle-bin/${itemId}/restore`, undefined, modToken);
    expect(restore.status).toBe(200);

    // Post-state: thread is retrievable again
    const get = await api.get(`/threads/${deletedThreadId}`, userToken);
    expect(get.status).toBe(200);
  });

  test("permission — USER cannot list recycle bin (403)", async () => {
    const res = await api.get("/moderation/recycle-bin", userToken);
    expect(res.status).toBe(403);
  });
});

// ─── Audit logs ───────────────────────────────────────────────────────────────

describe("GET /audit/logs", () => {
  test("success — returns paginated audit logs", async () => {
    const res = await api.get("/audit/logs", adminToken);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.pagination as Record<string, unknown>).total).toBeGreaterThan(0);
  });

  test("filter by eventType — only matching events returned", async () => {
    const res = await api.get("/audit/logs", adminToken, { eventType: "user.login" });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    data.forEach((log) => expect(log.eventType).toBe("user.login"));
  });

  test("filter by date range", async () => {
    const from = new Date(Date.now() - 3_600_000).toISOString();
    const to   = new Date().toISOString();
    const res = await api.get("/audit/logs", adminToken, { fromDate: from, toDate: to });
    expect(res.status).toBe(200);
  });

  test("permission — USER role cannot read audit logs (403)", async () => {
    const res = await api.get("/audit/logs", userToken);
    expect(res.status).toBe(403);
  });

  test("permission — ANALYST can read audit logs", async () => {
    const analystToken = await loginAs(TEST_ORG, CREDS.analyst.username, CREDS.analyst.password);
    const res = await api.get("/audit/logs", analystToken);
    expect(res.status).toBe(200);
  });
});

// ─── Role change ──────────────────────────────────────────────────────────────

describe("PATCH /moderation/users/:id/role", () => {
  test("success — admin can change a user's role (pre/post verified)", async () => {
    // Pre-state: user1 is USER
    const before = await api.get("/auth/me", userToken);
    expect((before.body as Record<string, unknown>).role).toBe("USER");

    // Change to MODERATOR
    const patch = await api.patch(
      `/moderation/users/${USER_IDS.user1}/role`,
      { role: "MODERATOR" },
      adminToken
    );
    expect(patch.status).toBe(200);
    expect((patch.body as Record<string, unknown>).role).toBe("MODERATOR");

    // Restore to USER
    await api.patch(
      `/moderation/users/${USER_IDS.user1}/role`,
      { role: "USER" },
      adminToken
    );
  });

  test("validation — invalid role returns 400", async () => {
    const res = await api.patch(
      `/moderation/users/${USER_IDS.user2}/role`,
      { role: "SUPERUSER" },
      adminToken
    );
    expect(res.status).toBe(400);
  });

  test("permission — MODERATOR cannot change roles (403)", async () => {
    const res = await api.patch(
      `/moderation/users/${USER_IDS.user2}/role`,
      { role: "MODERATOR" },
      modToken
    );
    expect(res.status).toBe(403);
  });
});
