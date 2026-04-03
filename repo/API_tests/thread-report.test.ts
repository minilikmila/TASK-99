/**
 * API tests — Thread Reporting
 *
 * Covers: POST /threads/:id/report endpoint, duplicate prevention,
 * and integration with the risk engine (>=5 reports triggers flag).
 */

import { api, loginAs, BASE_URL } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key-secret";

let adminToken: string;
let user1Token: string;
let user2Token: string;
let modToken: string;
let threadId: string;

beforeAll(async () => {
  [adminToken, user1Token, user2Token, modToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
    loginAs(TEST_ORG, CREDS.user2.username, CREDS.user2.password),
    loginAs(TEST_ORG, CREDS.mod.username, CREDS.mod.password),
  ]);

  // Create a thread to report
  const res = await api.post(
    "/threads",
    { sectionId: SECTION_IDS.alpha, title: "Thread to Report", body: "Report me" },
    user1Token
  );
  threadId = (res.body as Record<string, unknown>).id as string;
});

// ─── Basic report endpoint ───────────────────────────────────────────────────

describe("POST /threads/:id/report", () => {
  test("success — authenticated user can report a thread", async () => {
    const res = await api.post(`/threads/${threadId}/report`, { reason: "Spam" }, user2Token);
    expect(res.status).toBe(201);
    expect((res.body as Record<string, unknown>).message).toBe("Thread reported");
  });

  test("auth — no token returns 401", async () => {
    const res = await api.post(`/threads/${threadId}/report`, {});
    expect(res.status).toBe(401);
  });

  test("not found — reporting non-existent thread returns 404", async () => {
    const res = await api.post("/threads/nonexistent-id/report", {}, user1Token);
    expect(res.status).toBe(404);
  });

  test("duplicate — same user reporting same thread again within window → 409", async () => {
    // First report
    await api.post(`/threads/${threadId}/report`, { reason: "First" }, user1Token);
    // Duplicate
    const dup = await api.post(`/threads/${threadId}/report`, { reason: "Second" }, user1Token);
    expect(dup.status).toBe(409);
    expect((dup.body.error as Record<string, unknown>).code).toBe("DUPLICATE_REPORT");
  });

  test("different users CAN report the same thread", async () => {
    // Create a fresh thread for this test
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Multi-Report Thread", body: "body" },
      user1Token
    );
    const tid = (t.body as Record<string, unknown>).id as string;

    const r1 = await api.post(`/threads/${tid}/report`, { reason: "Spam" }, user1Token);
    const r2 = await api.post(`/threads/${tid}/report`, { reason: "Offensive" }, user2Token);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});

// ─── Report appears in audit log ─────────────────────────────────────────────

describe("Report audit trail", () => {
  test("report event appears in audit logs", async () => {
    const res = await api.get("/audit/logs", adminToken, { eventType: "thread.reported" });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].eventType).toBe("thread.reported");
    expect(data[0].resourceType).toBe("Thread");
  });
});

// ─── Risk engine integration ─────────────────────────────────────────────────

describe("Risk engine — high report volume triggers flag", () => {
  test("5 reports on same thread within window → risk flag created", async () => {
    // Create a fresh thread
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Risk Flag Thread", body: "body" },
      user1Token
    );
    const riskThreadId = (t.body as Record<string, unknown>).id as string;

    // We need 5 different users reporting. Analyst is read-only so cannot report.
    // Use: admin, user1, user2, mod, target (all have write access).
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    const reporters = [user1Token, user2Token, modToken, adminToken, targetToken];
    for (const token of reporters) {
      const r = await api.post(`/threads/${riskThreadId}/report`, { reason: "Bad content" }, token);
      expect([201]).toContain(r.status);
    }

    // Verify all 5 reports are recorded in audit log
    const auditRes = await api.get("/audit/logs", adminToken, {
      eventType: "thread.reported",
    });
    expect(auditRes.status).toBe(200);
    const reports = (auditRes.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const threadReports = reports.filter((r) => r.resourceId === riskThreadId);
    expect(threadReports.length).toBe(5);

    // Trigger risk rules via internal endpoint (Jest has no DATABASE_URL; the app container does)
    const meRes = await api.get("/auth/me", adminToken);
    const orgId = (meRes.body as Record<string, unknown>).organizationId as string;

    const riskRun = await fetch(`${BASE_URL}/api/v1/internal/risk/run-rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": INTERNAL_KEY,
      },
      body: JSON.stringify({ organizationId: orgId }),
    });
    expect(riskRun.status).toBe(200);

    // Assert the HIGH_REPORT_VOLUME risk flag was created for this thread
    const flagsRes = await api.get("/risk/flags", adminToken);
    expect(flagsRes.status).toBe(200);
    const flags = (flagsRes.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    const riskFlag = flags.find(
      (f) => f.subjectId === riskThreadId && f.rule === "HIGH_REPORT_VOLUME"
    );
    expect(riskFlag).toBeDefined();
    expect(riskFlag!.status).toBe("OPEN");
    expect(riskFlag!.subjectType).toBe("Thread");
  });
});
