/**
 * API tests — DB-driven configuration
 *
 * Verifies that operational config values are read from the database
 * (FeatureFlag table) and that changes take effect without restart.
 *
 * Critical tests:
 *   - Change maxPinnedPerSection in DB → pin limit changes immediately
 *   - Change maxReplyDepth in DB → depth limit changes immediately
 *   - Change mute duration limits in DB → validation changes immediately
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;

beforeAll(async () => {
  [adminToken, modToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username, CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);
});

// ─── Pin limit is DB-driven ──────────────────────────────────────────────────

describe("DB-driven pin limit (forum.max_pinned_per_section)", () => {
  // Use a dedicated section for pin tests to avoid interference
  let pinSectionId: string;

  beforeAll(async () => {
    const sec = await api.post("/sections", { name: "DB Config Pin Section" }, adminToken);
    pinSectionId = (sec.body as Record<string, unknown>).id as string;
  });

  afterAll(async () => {
    // Restore default pin limit
    await api.patch(
      "/admin/feature-flags/forum.max_pinned_per_section",
      { description: "3" },
      adminToken
    );
  });

  test("reduce pin limit to 1 in DB → 2nd pin rejected", async () => {
    // Set pin limit to 1
    await api.patch(
      "/admin/feature-flags/forum.max_pinned_per_section",
      { description: "1" },
      adminToken
    );

    // Create 2 threads in the pin section
    const t1 = await api.post(
      "/threads",
      { sectionId: pinSectionId, title: "Pin DB Test 1", body: "body" },
      userToken
    );
    const t2 = await api.post(
      "/threads",
      { sectionId: pinSectionId, title: "Pin DB Test 2", body: "body" },
      userToken
    );
    const id1 = (t1.body as Record<string, unknown>).id as string;
    const id2 = (t2.body as Record<string, unknown>).id as string;

    // Pin first thread — should succeed
    const pin1 = await api.post(`/threads/${id1}/pin`, undefined, modToken);
    expect(pin1.status).toBe(200);

    // Pin second thread — should fail (limit is now 1)
    const pin2 = await api.post(`/threads/${id2}/pin`, undefined, modToken);
    expect(pin2.status).toBe(409);
    expect((pin2.body.error as Record<string, unknown>).code).toBe("PIN_LIMIT_REACHED");
  });

  test("increase pin limit to 5 in DB → more pins allowed", async () => {
    // Set pin limit to 5
    await api.patch(
      "/admin/feature-flags/forum.max_pinned_per_section",
      { description: "5" },
      adminToken
    );

    // Create a new section for a clean slate
    const sec2 = await api.post("/sections", { name: "DB Config Pin Section 2" }, adminToken);
    const secId = (sec2.body as Record<string, unknown>).id as string;

    // Create and pin 4 threads (more than the old default of 3)
    for (let i = 0; i < 4; i++) {
      const t = await api.post(
        "/threads",
        { sectionId: secId, title: `Pin Expanded ${i}`, body: "body" },
        userToken
      );
      const tid = (t.body as Record<string, unknown>).id as string;
      const pin = await api.post(`/threads/${tid}/pin`, undefined, modToken);
      expect(pin.status).toBe(200);
    }
  });
});

// ─── Reply depth is DB-driven ────────────────────────────────────────────────

describe("DB-driven reply depth (forum.max_reply_depth)", () => {
  afterAll(async () => {
    // Restore default
    await api.patch(
      "/admin/feature-flags/forum.max_reply_depth",
      { description: "3" },
      adminToken
    );
  });

  test("reduce max reply depth to 2 → depth-3 reply rejected", async () => {
    // Set max depth to 2
    await api.patch(
      "/admin/feature-flags/forum.max_reply_depth",
      { description: "2" },
      adminToken
    );

    // Create thread
    const t = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Depth DB Test", body: "body" },
      userToken
    );
    const tid = (t.body as Record<string, unknown>).id as string;

    // Depth 1 reply
    const r1 = await api.post(`/threads/${tid}/replies`, { body: "Depth 1" }, userToken);
    expect(r1.status).toBe(201);
    const r1Id = (r1.body as Record<string, unknown>).id as string;

    // Depth 2 reply (within limit)
    const r2 = await api.post(
      `/threads/${tid}/replies`,
      { body: "Depth 2", parentReplyId: r1Id },
      userToken
    );
    expect(r2.status).toBe(201);
    const r2Id = (r2.body as Record<string, unknown>).id as string;

    // Depth 3 reply — should fail (limit is now 2)
    const r3 = await api.post(
      `/threads/${tid}/replies`,
      { body: "Depth 3", parentReplyId: r2Id },
      userToken
    );
    expect(r3.status).toBe(422);
    expect((r3.body.error as Record<string, unknown>).code).toBe("REPLY_DEPTH_EXCEEDED");
  });
});

// ─── Mute duration limits are DB-driven ──────────────────────────────────────

describe("DB-driven mute duration limits", () => {
  const targetId = "test-target-id";

  afterEach(async () => {
    await api.post(`/moderation/users/${targetId}/unmute`, undefined, adminToken);
  });

  afterAll(async () => {
    // Restore defaults
    await api.patch(
      "/admin/feature-flags/forum.mute_duration_min_hours",
      { description: "24" },
      adminToken
    );
    await api.patch(
      "/admin/feature-flags/forum.mute_duration_max_hours",
      { description: "720" },
      adminToken
    );
  });

  test("increase min mute to 48h in DB → 24h mute rejected", async () => {
    // Set minimum to 48 hours
    await api.patch(
      "/admin/feature-flags/forum.mute_duration_min_hours",
      { description: "48" },
      adminToken
    );

    // Try 24h mute — should fail
    const res = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 24 },
      modToken
    );
    expect(res.status).toBe(400);

    // 48h mute — should succeed
    const res2 = await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 48 },
      modToken
    );
    expect(res2.status).toBe(200);
  });
});

// ─── Config changes are audited ──────────────────────────────────────────────

describe("Config changes are audited", () => {
  test("updating a feature flag creates an audit log entry", async () => {
    // Make a config change
    await api.patch(
      "/admin/feature-flags/forum.max_pinned_per_section",
      { description: "3" },
      adminToken
    );

    // Check audit logs
    const res = await api.get("/audit/logs", adminToken, {
      eventType: "feature_flag.updated",
    });
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].eventType).toBe("feature_flag.updated");
  });
});
