/**
 * API tests — Tenant Isolation (Cross-Organization)
 *
 * Verifies that users in org1 CANNOT reference resources from org2
 * when creating threads. This prevents cross-tenant data leakage.
 *
 * Critical tests:
 *   - User in org1 uses sectionId from org2 → FAILS
 *   - User in org1 uses subsectionId not in specified section → FAILS
 *   - User in org1 uses tagId from org2 → FAILS
 *   - Valid creation within same org → SUCCEEDS
 */

import { api, loginAs } from "./helpers/client";
import {
  TEST_ORG,
  CREDS,
  SECTION_IDS,
  OTHER_ORG,
  OTHER_ORG_CREDS,
  OTHER_SECTION_ID,
  OTHER_TAG_ID,
} from "./helpers/fixtures";

let org1UserToken: string;
let org2UserToken: string;
let org1SubsectionId: string;

beforeAll(async () => {
  [org1UserToken, org2UserToken] = await Promise.all([
    loginAs(TEST_ORG, CREDS.user1.username, CREDS.user1.password),
    loginAs(OTHER_ORG, OTHER_ORG_CREDS.username, OTHER_ORG_CREDS.password),
  ]);

  // Create a subsection in org1 section alpha for subsection tests
  const adminToken = await loginAs(TEST_ORG, CREDS.admin.username, CREDS.admin.password);
  const subRes = await api.post(
    `/sections/${SECTION_IDS.alpha}/subsections`,
    { name: "Tenant Test Subsection" },
    adminToken
  );
  org1SubsectionId = (subRes.body as Record<string, unknown>).id as string;
});

// ─── Cross-org section violation ─────────────────────────────────────────────

describe("Thread creation — cross-tenant section isolation", () => {
  test("org1 user CANNOT create thread with org2 sectionId → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: OTHER_SECTION_ID,
        title: "Cross-tenant thread",
        body: "This should be rejected",
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });

  test("org1 user CAN create thread with org1 sectionId → 201", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        title: "Same-tenant thread",
        body: "This should work fine",
      },
      org1UserToken
    );
    expect(res.status).toBe(201);
  });

  test("org2 user CANNOT create thread with org1 sectionId → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        title: "Cross-tenant from org2",
        body: "Should be rejected",
      },
      org2UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });

  test("non-existent sectionId → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: "non-existent-section-xyz",
        title: "Bad section",
        body: "Should be rejected",
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });
});

// ─── Subsection-to-section validation ────────────────────────────────────────

describe("Thread creation — subsection must belong to section", () => {
  test("subsectionId from wrong section → 400 TENANT_VIOLATION", async () => {
    // org1SubsectionId belongs to SECTION_IDS.alpha — try it with SECTION_IDS.beta
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.beta,
        subsectionId: org1SubsectionId,
        title: "Wrong subsection parent",
        body: "Should be rejected",
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });

  test("non-existent subsectionId → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        subsectionId: "non-existent-subsection-xyz",
        title: "Bad subsection",
        body: "Should be rejected",
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });

  test("valid subsectionId in correct section → 201", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        subsectionId: org1SubsectionId,
        title: "Correct subsection",
        body: "Should work",
      },
      org1UserToken
    );
    expect(res.status).toBe(201);
  });
});

// ─── Cross-org tag violation ─────────────────────────────────────────────────

describe("Thread creation — cross-tenant tag isolation", () => {
  test("org1 user CANNOT use tagId from org2 → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        title: "Cross-tenant tag",
        body: "Should be rejected",
        tagIds: [OTHER_TAG_ID],
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });

  test("non-existent tagId → 400 TENANT_VIOLATION", async () => {
    const res = await api.post(
      "/threads",
      {
        sectionId: SECTION_IDS.alpha,
        title: "Bad tag",
        body: "Should be rejected",
        tagIds: ["non-existent-tag-xyz"],
      },
      org1UserToken
    );
    expect(res.status).toBe(400);
    expect((res.body.error as Record<string, unknown>).code).toBe("TENANT_VIOLATION");
  });
});

// ─── Cross-org read isolation ────────────────────────────────────────────────

describe("Cross-org read isolation", () => {
  test("org2 user CANNOT read org1 threads", async () => {
    const res = await api.get("/threads", org2UserToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    // Should only see threads from org2 (which has none), not org1
    expect(data.length).toBe(0);
  });

  test("org2 user CANNOT read org1 sections", async () => {
    const res = await api.get("/sections", org2UserToken);
    expect(res.status).toBe(200);
    const data = (res.body as Record<string, unknown>).data as Array<Record<string, unknown>>;
    // Should only see sections from org2
    const ids = data.map((s) => s.id);
    expect(ids).not.toContain(SECTION_IDS.alpha);
    expect(ids).not.toContain(SECTION_IDS.beta);
  });
});
