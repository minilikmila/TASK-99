/**
 * API tests — Tags
 *
 * Covers: CRUD, role-based access control, duplicate slug conflict.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS } from "./helpers/fixtures";

let adminToken: string;
let modToken: string;
let userToken: string;

// Use unique suffixes to avoid collisions with data from previous test runs
const RUN_ID = Date.now().toString(36);

beforeAll(async () => {
  [adminToken, modToken, userToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password),
    loginAs(TEST_ORG, CREDS.mod.username, CREDS.mod.password),
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
  ]);
});

describe("GET /tags", () => {
  test("success — returns tag list", async () => {
    const res = await api.get("/tags", userToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
  });

  test("auth — no token returns 401", async () => {
    const res = await api.get("/tags");
    expect(res.status).toBe(401);
  });
});

describe("POST /tags", () => {
  test("success — admin creates tag", async () => {
    const slug = `api-test-tag-${RUN_ID}`;
    const res = await api.post(
      "/tags",
      { name: `API Test Tag ${RUN_ID}`, slug },
      adminToken
    );
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.slug).toBe(slug);
  });

  test("success — moderator creates tag", async () => {
    const slug = `mod-test-tag-${RUN_ID}`;
    const res = await api.post(
      "/tags",
      { name: `Mod Tag ${RUN_ID}`, slug },
      modToken
    );
    expect(res.status).toBe(201);
  });

  test("role — USER cannot create tags (403)", async () => {
    const res = await api.post(
      "/tags",
      { name: "User Tag", slug: `user-tag-${RUN_ID}` },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("conflict — duplicate slug returns 409 or 400", async () => {
    const slug = `dup-slug-${RUN_ID}`;
    // Create first
    await api.post("/tags", { name: "Dup Tag", slug }, adminToken);
    // Try duplicate
    const res = await api.post(
      "/tags",
      { name: "Dup Tag 2", slug },
      adminToken
    );
    expect([400, 409]).toContain(res.status);
  });
});

describe("PATCH /tags/:tagId", () => {
  let tagId: string;

  beforeAll(async () => {
    const slug = `tag-to-update-${RUN_ID}`;
    const res = await api.post(
      "/tags",
      { name: "Tag To Update", slug },
      adminToken
    );
    tagId = (res.body as Record<string, unknown>).id as string;
  });

  test("success — admin updates tag name", async () => {
    const res = await api.patch(`/tags/${tagId}`, { name: "Updated Tag Name" }, adminToken);
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).name).toBe("Updated Tag Name");
  });

  test("role — USER cannot update tags (403)", async () => {
    const res = await api.patch(`/tags/${tagId}`, { name: "Nope" }, userToken);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /tags/:tagId", () => {
  let tagId: string;

  beforeAll(async () => {
    const slug = `tag-to-delete-${RUN_ID}`;
    const res = await api.post(
      "/tags",
      { name: "Tag To Delete", slug },
      adminToken
    );
    tagId = (res.body as Record<string, unknown>).id as string;
  });

  test("success — admin deletes tag", async () => {
    const res = await api.del(`/tags/${tagId}`, adminToken);
    expect([200, 204]).toContain(res.status);
  });

  test("role — USER cannot delete tags (403)", async () => {
    const slug = `no-del-tag-${RUN_ID}`;
    const create = await api.post(
      "/tags",
      { name: "No Del", slug },
      adminToken
    );
    const id = (create.body as Record<string, unknown>).id as string;
    const res = await api.del(`/tags/${id}`, userToken);
    expect(res.status).toBe(403);
  });
});
