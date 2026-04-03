/**
 * API tests — Real-time auth state enforcement
 *
 * Verifies that moderation/role changes take effect IMMEDIATELY
 * on existing tokens, without requiring re-login.
 *
 * Critical security tests:
 *   - Ban user → same token → request FAILS
 *   - Role downgrade → restricted endpoint → FAILS
 *   - Mute user → same token → thread creation FAILS
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, USER_IDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;

beforeAll(async () => {
  [adminToken, modToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username, CREDS.mod.password),
  ]);
});

// ─── Ban enforcement on existing tokens ──────────────────────────────────────

describe("Real-time ban enforcement", () => {
  const targetId = USER_IDS.target;

  afterEach(async () => {
    // Always clean up: unban the target
    await api.post(`/moderation/users/${targetId}/unban`, undefined, adminToken);
  });

  test("login → get token → ban user → same token → request FAILS with 403", async () => {
    // 1. Target logs in and gets a valid token
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    // 2. Token works before ban
    const beforeBan = await api.get("/threads", targetToken);
    expect(beforeBan.status).toBe(200);

    // 3. Admin bans the target
    const banRes = await api.post(`/moderation/users/${targetId}/ban`, undefined, adminToken);
    expect(banRes.status).toBe(200);

    // 4. Same token should now be rejected — ban enforced in real-time
    //    Gets 401 (tokenVersion mismatch) or 403 (USER_BANNED) — either is correct
    const afterBan = await api.get("/threads", targetToken);
    expect([401, 403]).toContain(afterBan.status);
    const code = (afterBan.body.error as Record<string, unknown>).code;
    expect(["TOKEN_REVOKED", "USER_BANNED"]).toContain(code);
  });

  test("banned user cannot re-login — gets USER_BANNED on login attempt", async () => {
    // Ban the target
    await api.post(`/moderation/users/${targetId}/ban`, undefined, adminToken);

    // Attempt to login — should get 403 USER_BANNED
    const loginRes = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.target.username,
      password: CREDS.target.password,
    });
    expect(loginRes.status).toBe(403);
    expect((loginRes.body.error as Record<string, unknown>).code).toBe("USER_BANNED");
  });

  test("ban → unban → user must re-login (old token still invalid)", async () => {
    // 1. Target logs in
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    // 2. Ban then unban
    await api.post(`/moderation/users/${targetId}/ban`, undefined, adminToken);
    await api.post(`/moderation/users/${targetId}/unban`, undefined, adminToken);

    // 3. Old token should still be invalid (tokenVersion bumped twice)
    const res = await api.get("/threads", targetToken);
    expect(res.status).toBe(401);

    // 4. Fresh login works
    const freshToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);
    const freshRes = await api.get("/threads", freshToken);
    expect(freshRes.status).toBe(200);
  });
});

// ─── Role downgrade enforcement on existing tokens ───────────────────────────

describe("Real-time role enforcement", () => {
  afterEach(async () => {
    // Restore target to USER role
    await api.patch(
      `/moderation/users/${USER_IDS.target}/role`,
      { role: "USER" },
      adminToken
    );
  });

  test("promote to MODERATOR → access mod endpoint → downgrade to USER → same token → mod endpoint FAILS", async () => {
    // 1. Promote target to MODERATOR
    await api.patch(
      `/moderation/users/${USER_IDS.target}/role`,
      { role: "MODERATOR" },
      adminToken
    );

    // 2. Target logs in with MODERATOR role
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    // 3. Access mod-only endpoint (recycle bin) — should work
    const beforeDowngrade = await api.get("/moderation/recycle-bin", targetToken);
    expect(beforeDowngrade.status).toBe(200);

    // 4. Admin downgrades target back to USER
    await api.patch(
      `/moderation/users/${USER_IDS.target}/role`,
      { role: "USER" },
      adminToken
    );

    // 5. Same token — mod endpoint should now be FORBIDDEN
    const afterDowngrade = await api.get("/moderation/recycle-bin", targetToken);
    // Either 401 (token invalidated) or 403 (role enforced from DB)
    expect([401, 403]).toContain(afterDowngrade.status);
  });

  test("role change invalidates token — user must re-login", async () => {
    // 1. Target logs in as USER
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    // 2. Admin changes role
    await api.patch(
      `/moderation/users/${USER_IDS.target}/role`,
      { role: "MODERATOR" },
      adminToken
    );

    // 3. Old token should be invalidated (tokenVersion bumped)
    const res = await api.get("/threads", targetToken);
    expect(res.status).toBe(401);

    // 4. Fresh login gets the new role
    const freshToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);
    const me = await api.get("/auth/me", freshToken);
    expect(me.status).toBe(200);
    expect((me.body as Record<string, unknown>).role).toBe("MODERATOR");
  });
});

// ─── Mute enforcement on existing tokens ─────────────────────────────────────

describe("Real-time mute enforcement", () => {
  const targetId = USER_IDS.target;

  afterEach(async () => {
    await api.post(`/moderation/users/${targetId}/unmute`, undefined, adminToken);
    // Restore role in case previous test changed it
    await api.patch(
      `/moderation/users/${targetId}/role`,
      { role: "USER" },
      adminToken
    );
  });

  test("login → mute → same token invalidated → re-login → thread creation blocked", async () => {
    // 1. Target logs in
    const targetToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);

    // 2. Can create thread before mute
    const before = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "Before Mute", body: "Should work" },
      targetToken
    );
    expect(before.status).toBe(201);

    // 3. Admin mutes the target
    await api.post(
      `/moderation/users/${targetId}/mute`,
      { durationHours: 24 },
      adminToken
    );

    // 4. Old token is invalidated by tokenVersion bump
    const staleRes = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "After Mute Stale", body: "Should fail" },
      targetToken
    );
    expect(staleRes.status).toBe(401);

    // 5. Re-login and try — mute enforced from DB
    const freshToken = await loginAs(TEST_ORG, CREDS.target.username, CREDS.target.password);
    const afterMute = await api.post(
      "/threads",
      { sectionId: SECTION_IDS.alpha, title: "After Mute Fresh", body: "Should fail" },
      freshToken
    );
    expect(afterMute.status).toBe(403);
    expect((afterMute.body.error as Record<string, unknown>).code).toBe("USER_MUTED");
  });
});
