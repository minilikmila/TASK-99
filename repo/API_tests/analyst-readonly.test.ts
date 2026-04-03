/**
 * API tests — Analyst role is strictly read-only
 *
 * Verifies that ANALYST users cannot create, update, or delete
 * threads or replies. They can only read.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let analystToken: string;
let userToken: string;
let threadId: string;
let replyId: string;

beforeAll(async () => {
  [analystToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.analyst.username, CREDS.analyst.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);

  // Create test data with a regular user
  const t = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Analyst Test Thread", body: "body" },
    userToken
  );
  threadId = (t.body as Record<string, unknown>).id as string;

  const r = await api.post(
    `/threads/${threadId}/replies`,
    { body: "Analyst test reply" },
    userToken
  );
  replyId = (r.body as Record<string, unknown>).id as string;
});

// ─── Thread write operations blocked ─────────────────────────────────────────

describe("ANALYST cannot write threads", () => {
  test("POST /threads → 403", async () => {
    const res = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Analyst Thread", body: "Should fail" },
      analystToken
    );
    expect(res.status).toBe(403);
  });

  test("PATCH /threads/:id → 403", async () => {
    const res = await api.patch(
      `/threads/${threadId}`,
      { title: "Analyst Edit" },
      analystToken
    );
    expect(res.status).toBe(403);
  });

  test("DELETE /threads/:id → 403", async () => {
    const res = await api.del(`/threads/${threadId}`, analystToken);
    expect(res.status).toBe(403);
  });

  test("POST /threads/:id/report → 403", async () => {
    const res = await api.post(`/threads/${threadId}/report`, {}, analystToken);
    expect(res.status).toBe(403);
  });
});

// ─── Reply write operations blocked ──────────────────────────────────────────

describe("ANALYST cannot write replies", () => {
  test("POST /threads/:id/replies → 403", async () => {
    const res = await api.post(
      `/threads/${threadId}/replies`,
      { body: "Analyst reply" },
      analystToken
    );
    expect(res.status).toBe(403);
  });

  test("PATCH /replies/:id → 403", async () => {
    const res = await api.patch(
      `/replies/${replyId}`,
      { body: "Analyst edit reply" },
      analystToken
    );
    expect(res.status).toBe(403);
  });

  test("DELETE /replies/:id → 403", async () => {
    const res = await api.del(`/replies/${replyId}`, analystToken);
    expect(res.status).toBe(403);
  });
});

// ─── Read operations still work ──────────────────────────────────────────────

describe("ANALYST can still read", () => {
  test("GET /threads → 200", async () => {
    const res = await api.get("/threads", analystToken);
    expect(res.status).toBe(200);
  });

  test("GET /threads/:id → 200", async () => {
    const res = await api.get(`/threads/${threadId}`, analystToken);
    expect(res.status).toBe(200);
  });

  test("GET /threads/:id/replies → 200", async () => {
    const res = await api.get(`/threads/${threadId}/replies`, analystToken);
    expect(res.status).toBe(200);
  });

  test("GET /sections → 200", async () => {
    const res = await api.get("/sections", analystToken);
    expect(res.status).toBe(200);
  });

  test("GET /audit/logs → 200", async () => {
    const res = await api.get("/audit/logs", analystToken);
    expect(res.status).toBe(200);
  });

  test("GET /analytics/funnel → 200", async () => {
    const res = await api.get("/analytics/funnel", analystToken, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
    });
    expect(res.status).toBe(200);
  });
});
