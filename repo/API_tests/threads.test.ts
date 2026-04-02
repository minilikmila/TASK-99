/**
 * API tests — Threads
 *
 * Covers: CRUD, state machine transitions (including irreversible archived),
 * pin limit enforcement, pre/post state verification, and permission checks.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;

// IDs created during setup — shared within this file
let thread1Id: string;   // used for state/pin tests
let thread2Id: string;
let thread3Id: string;
let pinThread1: string;  // used to hit pin limit
let pinThread2: string;
let pinThread3: string;

beforeAll(async () => {
  [adminToken, modToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username,  CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username,    CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username,  CREDS.user1.password),
  ]);

  // Create threads used in multiple tests
  const [r1, r2, r3, p1, p2, p3] = await Promise.all([
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Thread One", body: "Body of thread one" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Thread Two", body: "Body of thread two" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.alpha, title: "Thread Three", body: "Body of thread three" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.beta, title: "Pin Test A", body: "Pin body A" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.beta, title: "Pin Test B", body: "Pin body B" }, userToken),
    api.post("/threads", { sectionId: SECTION_IDS.beta, title: "Pin Test C", body: "Pin body C" }, userToken),
  ]);

  thread1Id   = (r1.body as Record<string, unknown>).id as string;
  thread2Id   = (r2.body as Record<string, unknown>).id as string;
  thread3Id   = (r3.body as Record<string, unknown>).id as string;
  pinThread1  = (p1.body as Record<string, unknown>).id as string;
  pinThread2  = (p2.body as Record<string, unknown>).id as string;
  pinThread3  = (p3.body as Record<string, unknown>).id as string;
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe("POST /threads", () => {
  test("success — creates thread and returns 201 with full data", async () => {
    const res = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "New Thread Title", body: "Thread body content here" },
      userToken
    );
    expect(res.status).toBe(201);
    const t = res.body as Record<string, unknown>;
    expect(t.id).toBeTruthy();
    expect(t.title).toBe("New Thread Title");
    expect(t.state).toBe("ACTIVE");
    expect(t.isPinned).toBe(false);
    expect(typeof t.createdAt).toBe("string");
  });

  test("validation — missing sectionId returns 400", async () => {
    const res = await api.post(
      "/threads",
      { title: "No Section", body: "Some body" },
      userToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("VALIDATION_ERROR");
  });

  test("validation — missing title returns 400", async () => {
    const res = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, body: "Some body" },
      userToken
    );
    expect(res.status).toBe(400);
  });

  test("validation — missing body returns 400", async () => {
    const res = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Title Only" },
      userToken
    );
    expect(res.status).toBe(400);
  });

  test("auth — no token returns 401", async () => {
    const res = await api.post("/threads", {
      sectionId: SECTION_IDS.alpha,
      title: "Unauth",
      body: "body",
    });
    expect(res.status).toBe(401);
  });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe("GET /threads", () => {
  test("success — returns paginated list", async () => {
    const res = await api.get("/threads", userToken);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.pagination as Record<string, unknown>).total).toBeGreaterThan(0);
  });

  test("filter by sectionId — only returns matching threads", async () => {
    const res = await api.get("/threads", userToken, { sectionId: SECTION_IDS.beta });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    data.forEach((t) => expect(t.sectionId).toBe(SECTION_IDS.beta));
  });

  test("filter by non-existent section — returns empty list", async () => {
    const res = await api.get("/threads", userToken, { sectionId: "nonexistent-section-id" });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as unknown[];
    expect(data).toHaveLength(0);
  });
});

// ─── Get ──────────────────────────────────────────────────────────────────────

describe("GET /threads/:id", () => {
  test("success — returns thread with author and tags", async () => {
    const res = await api.get(`/threads/${thread1Id}`, userToken);
    expect(res.status).toBe(200);
    const t = res.body as Record<string, unknown>;
    expect(t.id).toBe(thread1Id);
    expect(t.title).toBe("Thread One");
    expect((t.author as Record<string, unknown>).username).toBe(CREDS.user1.username);
  });

  test("not found — nonexistent ID returns 404", async () => {
    const res = await api.get("/threads/does-not-exist-xyz", userToken);
    expect(res.status).toBe(404);
    expect((res.body.error as Record<string, unknown>).code).toBe("NOT_FOUND");
  });
});

// ─── Update (pre/post state verification) ────────────────────────────────────

describe("PATCH /threads/:id", () => {
  test("success — title and body update verified pre/post", async () => {
    // Pre-state
    const before = await api.get(`/threads/${thread2Id}`, userToken);
    expect((before.body as Record<string, unknown>).title).toBe("Thread Two");

    // Update
    const patch = await api.patch(
      `/threads/${thread2Id}`,
      { title: "Thread Two Updated", body: "Updated body text" },
      userToken
    );
    expect(patch.status).toBe(200);

    // Post-state
    const after = await api.get(`/threads/${thread2Id}`, userToken);
    expect((after.body as Record<string, unknown>).title).toBe("Thread Two Updated");
    expect((after.body as Record<string, unknown>).body).toBe("Updated body text");
  });

  test("auth — no token returns 401", async () => {
    const res = await api.patch(`/threads/${thread2Id}`, { title: "Nope" });
    expect(res.status).toBe(401);
  });
});

// ─── State transitions ────────────────────────────────────────────────────────

describe("POST /threads/:id/state", () => {
  let stateThreadId: string;

  beforeAll(async () => {
    const r = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "State Test Thread", body: "For state machine tests" },
      userToken
    );
    stateThreadId = (r.body as Record<string, unknown>).id as string;
  });

  test("ACTIVE → LOCKED succeeds, state is LOCKED after", async () => {
    const res = await api.post(
      `/threads/${stateThreadId}/state`,
      { toState: "LOCKED" },
      modToken
    );
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).state).toBe("LOCKED");

    const get = await api.get(`/threads/${stateThreadId}`, userToken);
    expect((get.body as Record<string, unknown>).state).toBe("LOCKED");
  });

  test("LOCKED → ACTIVE is rejected (no rollback)", async () => {
    const res = await api.post(
      `/threads/${stateThreadId}/state`,
      { toState: "ACTIVE" },
      modToken
    );
    expect(res.status).toBe(422);
    expect((res.body.error as Record<string, unknown>).code).toBe("INVALID_STATE_TRANSITION");
  });

  test("LOCKED → ARCHIVED succeeds", async () => {
    const res = await api.post(
      `/threads/${stateThreadId}/state`,
      { toState: "ARCHIVED" },
      modToken
    );
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).state).toBe("ARCHIVED");
  });

  test("ARCHIVED → LOCKED is rejected (irreversible)", async () => {
    const res = await api.post(
      `/threads/${stateThreadId}/state`,
      { toState: "LOCKED" },
      modToken
    );
    expect(res.status).toBe(422);
    expect((res.body.error as Record<string, unknown>).code).toBe("INVALID_STATE_TRANSITION");
  });

  test("ARCHIVED → ACTIVE is rejected (irreversible)", async () => {
    const res = await api.post(
      `/threads/${stateThreadId}/state`,
      { toState: "ACTIVE" },
      modToken
    );
    expect(res.status).toBe(422);
  });

  test("permission — USER role cannot change state (403)", async () => {
    const r = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "User State Test", body: "body" },
      userToken
    );
    const id = (r.body as Record<string, unknown>).id as string;
    const res = await api.post(`/threads/${id}/state`, { toState: "LOCKED" }, userToken);
    expect(res.status).toBe(403);
    expect((res.body.error as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("validation — invalid toState returns 400", async () => {
    const r = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Val Test", body: "body" },
      userToken
    );
    const id = (r.body as Record<string, unknown>).id as string;
    const res = await api.post(`/threads/${id}/state`, { toState: "PUBLISHED" }, modToken);
    expect(res.status).toBe(400);
  });
});

// ─── Pin / Unpin ──────────────────────────────────────────────────────────────

describe("POST /threads/:id/pin — pin limit enforcement", () => {
  test("pin 3 threads in same section succeeds", async () => {
    for (const id of [pinThread1, pinThread2, pinThread3]) {
      const res = await api.post(`/threads/${id}/pin`, undefined, modToken);
      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).isPinned).toBe(true);
    }
  });

  test("4th pin in same section returns 409 (limit=3)", async () => {
    const extra = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.beta, title: "Pin Overflow", body: "body" },
      userToken
    );
    const extraId = (extra.body as Record<string, unknown>).id as string;
    const res = await api.post(`/threads/${extraId}/pin`, undefined, modToken);
    expect(res.status).toBe(409);
    expect((res.body.error as Record<string, unknown>).code).toBe("PIN_LIMIT_REACHED");
  });

  test("unpin frees a slot", async () => {
    // Unpin one
    const unpin = await api.post(`/threads/${pinThread3}/unpin`, undefined, modToken);
    expect(unpin.status).toBe(200);
    expect((unpin.body as Record<string, unknown>).isPinned).toBe(false);
  });
});

// ─── Delete (soft-delete / recycle bin pre/post) ──────────────────────────────

describe("DELETE /threads/:id", () => {
  test("soft-delete: thread disappears from list, appears in recycle bin", async () => {
    const create = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "To Be Deleted", body: "Delete me" },
      userToken
    );
    const id = (create.body as Record<string, unknown>).id as string;

    // Pre-state: thread is retrievable
    const before = await api.get(`/threads/${id}`, userToken);
    expect(before.status).toBe(200);

    // Delete
    const del = await api.del(`/threads/${id}`, userToken);
    expect(del.status).toBe(204);

    // Post-state: thread not found
    const after = await api.get(`/threads/${id}`, userToken);
    expect(after.status).toBe(404);

    // Post-state: appears in recycle bin
    const bin = await api.get("/moderation/recycle-bin", modToken);
    expect(bin.status).toBe(200);
    const items = (bin.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const found = items.some((item) => item.threadId === id);
    expect(found).toBe(true);
  });
});
