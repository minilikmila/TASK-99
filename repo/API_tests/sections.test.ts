/**
 * API tests — Sections & Subsections
 *
 * Covers: list, create, update, and subsection management.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS, SECTION_IDS } from "./helpers/fixtures";

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  [adminToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);
});

// ─── Sections ─────────────────────────────────────────────────────────────────

describe("GET /sections", () => {
  test("success — returns seeded sections", async () => {
    const res = await api.get("/sections", userToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    const ids = data.map((s) => s.id);
    expect(ids).toContain(SECTION_IDS.alpha);
    expect(ids).toContain(SECTION_IDS.beta);
  });

  test("auth — no token returns 401", async () => {
    const res = await api.get("/sections");
    expect(res.status).toBe(401);
  });
});

describe("POST /sections", () => {
  test("success — creates section with name and description", async () => {
    const res = await api.post(
      "/sections",
      { name: "API Test Section", description: "Created by API test" },
      adminToken
    );
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("API Test Section");
    expect(body.description).toBe("Created by API test");
  });

  test("validation — missing name returns 400", async () => {
    const res = await api.post("/sections", { description: "No name" }, adminToken);
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("VALIDATION_ERROR");
  });

  test("auth — no token returns 401", async () => {
    const res = await api.post("/sections", { name: "Anon Section" });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /sections/:id", () => {
  test("success — updates section name (pre/post verified)", async () => {
    // Create a section to update
    const create = await api.post(
      "/sections",
      { name: "Section To Update" },
      adminToken
    );
    const id = (create.body as Record<string, unknown>).id as string;

    // Update it
    const update = await api.patch(`/sections/${id}`, { name: "Section Updated" }, adminToken);
    expect(update.status).toBe(200);
    expect((update.body as Record<string, unknown>).name).toBe("Section Updated");
  });

  test("auth — no token returns 401", async () => {
    const res = await api.patch(`/sections/${SECTION_IDS.alpha}`, { name: "x" });
    expect(res.status).toBe(401);
  });
});

// ─── Subsections ──────────────────────────────────────────────────────────────

describe("Subsections", () => {
  let subsectionId: string;

  test("POST /sections/:id/subsections — creates subsection", async () => {
    const res = await api.post(
      `/sections/${SECTION_IDS.alpha}/subsections`,
      { name: "API Test Subsection" },
      adminToken
    );
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("API Test Subsection");
    expect(body.sectionId).toBe(SECTION_IDS.alpha);
    subsectionId = body.id as string;
  });

  test("GET /sections/:id/subsections — lists subsections", async () => {
    const res = await api.get(`/sections/${SECTION_IDS.alpha}/subsections`, userToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
  });

  test("validation — missing subsection name returns 400", async () => {
    const res = await api.post(
      `/sections/${SECTION_IDS.alpha}/subsections`,
      {},
      adminToken
    );
    expect(res.status).toBe(400);
  });
});
