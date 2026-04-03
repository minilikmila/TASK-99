/**
 * API tests — Featured thread lifecycle
 *
 * Covers: POST /threads/:id/feature and /unfeature endpoints,
 * RBAC (mod/admin only), conflict handling, audit events.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;
let threadId: string;

beforeAll(async () => {
  [adminToken, modToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username, CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);

  const res = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Feature Test Thread", body: "body" },
    userToken
  );
  threadId = (res.body as Record<string, unknown>).id as string;
});

describe("POST /threads/:id/feature", () => {
  test("moderator can feature a thread", async () => {
    const res = await api.post(`/threads/${threadId}/feature`, undefined, modToken);
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).isFeatured).toBe(true);
  });

  test("already featured → 409 CONFLICT", async () => {
    const res = await api.post(`/threads/${threadId}/feature`, undefined, modToken);
    expect(res.status).toBe(409);
    expect((res.body.error as Record<string, unknown>).code).toBe("CONFLICT");
  });

  test("USER role → 403", async () => {
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "User Feature Test", body: "body" },
      userToken
    );
    const tid = (t.body as Record<string, unknown>).id as string;
    const res = await api.post(`/threads/${tid}/feature`, undefined, userToken);
    expect(res.status).toBe(403);
  });

  test("isFeatured NOT accepted in thread creation body", async () => {
    const res = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Featured Create Test", body: "body", isFeatured: true },
      userToken
    );
    // Should succeed but isFeatured should be false (stripped from input)
    expect(res.status).toBe(201);
    expect((res.body as Record<string, unknown>).isFeatured).toBe(false);
  });
});

describe("POST /threads/:id/unfeature", () => {
  test("admin can unfeature a thread", async () => {
    const res = await api.post(`/threads/${threadId}/unfeature`, undefined, adminToken);
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).isFeatured).toBe(false);
  });

  test("not featured → 409 CONFLICT", async () => {
    const res = await api.post(`/threads/${threadId}/unfeature`, undefined, modToken);
    expect(res.status).toBe(409);
  });

  test("USER role → 403", async () => {
    const res = await api.post(`/threads/${threadId}/unfeature`, undefined, userToken);
    expect(res.status).toBe(403);
  });
});

describe("Feature/unfeature audit trail", () => {
  test("feature event appears in audit logs", async () => {
    // Feature a thread first
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Audit Feature Test", body: "body" },
      userToken
    );
    const tid = (t.body as Record<string, unknown>).id as string;
    await api.post(`/threads/${tid}/feature`, undefined, modToken);

    const res = await api.get("/audit/logs", adminToken, { eventType: "thread.featured" });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].eventType).toBe("thread.featured");
  });
});
