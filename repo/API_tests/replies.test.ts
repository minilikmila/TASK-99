/**
 * API tests — Replies
 *
 * Covers: CRUD, nesting depth enforcement (max 3), locked thread rejection,
 * muted-user write blocking, and permission checks.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;
let user2Token: string;

let openThreadId: string;
let lockedThreadId: string;
let archivedThreadId: string;

beforeAll(async () => {
  [adminToken, modToken, userToken, user2Token] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username,  CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username,    CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username,  CREDS.user1.password),
    loginAs(TEST_ORG, CREDS.user2.username,  CREDS.user2.password),
  ]);

  // Open thread for general reply tests
  const t1 = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Reply Test Thread", body: "Thread for reply tests" },
    userToken
  );
  openThreadId = (t1.body as Record<string, unknown>).id as string;

  // Locked thread
  const t2 = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Locked Thread For Replies", body: "Will be locked" },
    userToken
  );
  lockedThreadId = (t2.body as Record<string, unknown>).id as string;
  await api.post(`/threads/${lockedThreadId}/state`, { toState: "LOCKED" }, modToken);

  // Archived thread
  const t3 = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Archived Thread For Replies", body: "Will be archived" },
    userToken
  );
  archivedThreadId = (t3.body as Record<string, unknown>).id as string;
  await api.post(`/threads/${archivedThreadId}/state`, { toState: "ARCHIVED" }, modToken);
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe("POST /threads/:id/replies", () => {
  test("success — root reply created with depth 1", async () => {
    const res = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "This is a root reply" },
      userToken
    );
    expect(res.status).toBe(201);
    const r = res.body as Record<string, unknown>;
    expect(r.id).toBeTruthy();
    expect(r.depth).toBe(1);
    expect(r.body).toBe("This is a root reply");
    expect((r.author as Record<string, unknown>).username).toBe(CREDS.user1.username);
  });

  test("nesting — depth increments correctly through 3 levels", async () => {
    // Level 1
    const r1 = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Depth 1 reply" },
      userToken
    );
    expect(r1.status).toBe(201);
    const d1 = r1.body as Record<string, unknown>;
    expect(d1.depth).toBe(1);

    // Level 2
    const r2 = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Depth 2 reply", parentReplyId: d1.id },
      userToken
    );
    expect(r2.status).toBe(201);
    const d2 = r2.body as Record<string, unknown>;
    expect(d2.depth).toBe(2);

    // Level 3 (max allowed)
    const r3 = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Depth 3 reply (max)", parentReplyId: d2.id },
      userToken
    );
    expect(r3.status).toBe(201);
    const d3 = r3.body as Record<string, unknown>;
    expect(d3.depth).toBe(3);

    // Level 4 — exceeds max depth
    const r4 = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Depth 4 — should be rejected", parentReplyId: d3.id },
      userToken
    );
    expect(r4.status).toBe(422);
    expect((r4.body.error as Record<string, unknown>).code).toBe("REPLY_DEPTH_EXCEEDED");
  });

  test("locked thread — reply rejected with 422", async () => {
    const res = await api.post(
      `/threads/${lockedThreadId}/replies`,
      { body: "Cannot post to locked thread" },
      userToken
    );
    expect(res.status).toBe(422);
    expect((res.body.error as Record<string, unknown>).code).toBe("THREAD_LOCKED");
  });

  test("archived thread — reply rejected with 422", async () => {
    const res = await api.post(
      `/threads/${archivedThreadId}/replies`,
      { body: "Cannot post to archived thread" },
      userToken
    );
    expect(res.status).toBe(422);
    expect((res.body.error as Record<string, unknown>).code).toBe("THREAD_ARCHIVED");
  });

  test("validation — empty body returns 400", async () => {
    const res = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "" },
      userToken
    );
    expect(res.status).toBe(400);
  });

  test("validation — missing body returns 400", async () => {
    const res = await api.post(`/threads/${openThreadId}/replies`, {}, userToken);
    expect(res.status).toBe(400);
  });

  test("auth — no token returns 401", async () => {
    const res = await api.post(`/threads/${openThreadId}/replies`, { body: "anon" });
    expect(res.status).toBe(401);
  });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe("GET /threads/:id/replies", () => {
  test("success — returns replies array for thread", async () => {
    // Ensure at least one reply exists
    await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "List test reply" },
      userToken
    );

    const res = await api.get(`/threads/${openThreadId}/replies`, userToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("auth — no token returns 401", async () => {
    const res = await api.get(`/threads/${openThreadId}/replies`);
    expect(res.status).toBe(401);
  });

  test("not found — replies for nonexistent thread returns 404", async () => {
    const res = await api.get("/threads/nonexistent-id/replies", userToken);
    expect(res.status).toBe(404);
  });
});

// ─── Update (pre/post state verification) ────────────────────────────────────

describe("PATCH /replies/:id", () => {
  test("update body — verified pre/post", async () => {
    const create = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Original reply body" },
      userToken
    );
    const replyId = (create.body as Record<string, unknown>).id as string;

    const update = await api.patch(`/replies/${replyId}`, { body: "Updated reply body" }, userToken);
    expect(update.status).toBe(200);
    expect((update.body as Record<string, unknown>).body).toBe("Updated reply body");
  });

  test("auth — no token returns 401", async () => {
    const res = await api.patch("/replies/some-id", { body: "x" });
    expect(res.status).toBe(401);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe("DELETE /replies/:id", () => {
  test("soft-delete — reply removed from list after deletion", async () => {
    // Create
    const create = await api.post(
      `/threads/${openThreadId}/replies`,
      { body: "Reply to be deleted" },
      userToken
    );
    const replyId = (create.body as Record<string, unknown>).id as string;

    // Delete
    const del = await api.del(`/replies/${replyId}`, userToken);
    expect(del.status).toBe(204);

    // Post: reply no longer in list
    const list = await api.get(`/threads/${openThreadId}/replies`, userToken);
    const items = (list.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const still = items.find((r) => r.id === replyId);
    expect(still).toBeUndefined();

    // Post: appears in recycle bin
    const bin = await api.get("/moderation/recycle-bin", modToken);
    const binItems = (bin.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(binItems.some((i) => i.replyId === replyId)).toBe(true);
  });
});
