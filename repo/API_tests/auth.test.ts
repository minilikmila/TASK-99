/**
 * API tests — Authentication
 *
 * Covers: login success/failure, field validation, lockout hints,
 * token-protected endpoints, and logout.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS } from "./helpers/fixtures";

describe("POST /auth/login", () => {
  test("success — returns token and user fields", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.admin.username,
      password: CREDS.admin.password,
    });

    expect(res.status).toBe(200);
    const token = res.body.token;
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(10);

    const user = res.body.user as Record<string, unknown>;
    expect(user.username).toBe(CREDS.admin.username);
    expect(user.role).toBe("ADMINISTRATOR");
    // Never expose password hash
    expect(user.passwordHash).toBeUndefined();
  });

  test("fails — wrong password returns 401", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.admin.username,
      password: "wrong-password-12345",
    });
    expect(res.status).toBe(401);
    expect((res.body.error as Record<string, unknown>).code).toBe("UNAUTHORIZED");
  });

  test("fails — unknown username returns 401", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: "nobody-exists-here",
      password: "correct-length-pass",
    });
    expect(res.status).toBe(401);
  });

  test("fails — unknown org returns 401", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: "no-such-org-exists",
      username: CREDS.admin.username,
      password: CREDS.admin.password,
    });
    expect(res.status).toBe(401);
  });

  test("validation — missing organizationSlug returns 400", async () => {
    const res = await api.post("/auth/login", {
      username: CREDS.admin.username,
      password: CREDS.admin.password,
    });
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("VALIDATION_ERROR");
  });

  test("validation — missing password returns 400", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.admin.username,
    });
    expect(res.status).toBe(400);
  });

  test("validation — password shorter than 12 chars returns 400", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.admin.username,
      password: "short",
    });
    expect(res.status).toBe(400);
    const issues = ((res.body.error as Record<string, unknown>).details as Record<string, unknown>)?.issues;
    expect(Array.isArray(issues)).toBe(true);
  });

  test("validation — empty body returns 400", async () => {
    const res = await api.post("/auth/login", {});
    expect(res.status).toBe(400);
  });

  test("all user roles can log in", async () => {
    for (const [role, cred] of Object.entries(CREDS)) {
      if (role === "target") continue; // reserved for moderation tests
      const res = await api.post("/auth/login", {
        organizationSlug: TEST_ORG,
        username: cred.username,
        password: cred.password,
      });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe("string");
    }
  });
});

describe("GET /auth/me", () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password);
  });

  test("success — returns own user profile", async () => {
    const res = await api.get("/auth/me", token);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.username).toBe(CREDS.user1.username);
    expect(body.role).toBe("USER");
    expect(body.organizationId).toBeDefined();
    expect(body.passwordHash).toBeUndefined();
  });

  test("fails — no token returns 401", async () => {
    const res = await api.get("/auth/me");
    expect(res.status).toBe(401);
    expect((res.body.error as Record<string, unknown>).code).toBe("UNAUTHORIZED");
  });

  test("fails — malformed token returns 401", async () => {
    const res = await api.get("/auth/me", "not.a.valid.jwt.token");
    expect(res.status).toBe(401);
  });

  test("fails — Bearer prefix missing returns 401", async () => {
    const res = await fetch(`${(await import("./helpers/client")).BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: token }, // no "Bearer " prefix
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password);
  });

  test("success — stateless logout returns 200", async () => {
    const res = await api.post("/auth/logout", undefined, token);
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).message).toBeTruthy();
  });

  test("fails — logout without token returns 401", async () => {
    const res = await api.post("/auth/logout");
    expect(res.status).toBe(401);
  });
});

// ─── Token revocation ─────────────────────────────────────────────────────────

describe("Token revocation on logout", () => {
  test("revoked token returns 401 TOKEN_REVOKED on subsequent requests", async () => {
    // Login and capture token
    const loginRes = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.user2.username,
      password: CREDS.user2.password,
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token as string;

    // Token works before logout
    const meBefore = await api.get("/auth/me", token);
    expect(meBefore.status).toBe(200);

    // Logout — token is revoked
    const logoutRes = await api.post("/auth/logout", undefined, token);
    expect(logoutRes.status).toBe(200);

    // Same token should now be rejected
    const meAfter = await api.get("/auth/me", token);
    expect(meAfter.status).toBe(401);
    expect((meAfter.body.error as Record<string, unknown>).code).toBe("TOKEN_REVOKED");
  });

  test("token remains valid when logout is NOT called", async () => {
    const loginRes = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.user2.username,
      password: CREDS.user2.password,
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token as string;

    // Token should remain valid without logout
    const meRes = await api.get("/auth/me", token);
    expect(meRes.status).toBe(200);
  });

  test("revoked token is rejected on protected endpoints other than /auth/me", async () => {
    const loginRes = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.user2.username,
      password: CREDS.user2.password,
    });
    const token = loginRes.body.token as string;

    await api.post("/auth/logout", undefined, token);

    // Should fail on any protected endpoint
    const threadsRes = await api.get("/threads", token);
    expect(threadsRes.status).toBe(401);
    expect((threadsRes.body.error as Record<string, unknown>).code).toBe("TOKEN_REVOKED");
  });
});

describe("Response headers", () => {
  test("every response includes X-Correlation-Id", async () => {
    const res = await api.post("/auth/login", {
      organizationSlug: TEST_ORG,
      username: CREDS.admin.username,
      password: CREDS.admin.password,
    });
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  test("client-supplied X-Correlation-Id is echoed back", async () => {
    const cid = "my-trace-id-abc-123";
    const res = await fetch(
      `${(await import("./helpers/client")).BASE_URL}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Correlation-Id": cid },
        body: JSON.stringify({
          organizationSlug: TEST_ORG,
          username: CREDS.admin.username,
          password: CREDS.admin.password,
        }),
      }
    );
    expect(res.headers.get("x-correlation-id")).toBe(cid);
  });
});
