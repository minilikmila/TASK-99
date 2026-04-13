/**
 * API tests — Admin Configuration
 *
 * Covers: announcements, carousel items, venues & bookings role policies.
 */

import { api, loginAs } from "./helpers/client";
import { TEST_ORG, CREDS } from "./helpers/fixtures";

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

// ─── Announcements ───────────────────────────────────────────────────────────

describe("Announcements", () => {
  let announcementId: string;

  test("POST /admin/announcements — admin creates announcement", async () => {
    const res = await api.post(
      "/admin/announcements",
      { title: "Test Announcement", body: "Announcement body text" },
      adminToken
    );
    expect(res.status).toBe(201);
    announcementId = (res.body as Record<string, unknown>).id as string;
    expect(announcementId).toBeTruthy();
  });

  test("GET /admin/announcements — moderator can list announcements", async () => {
    const res = await api.get("/admin/announcements", modToken);
    expect(res.status).toBe(200);
  });

  test("POST /admin/announcements — USER cannot create (403)", async () => {
    const res = await api.post(
      "/admin/announcements",
      { title: "Unauthorized", body: "body" },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("PATCH /admin/announcements — USER cannot update (403)", async () => {
    const res = await api.patch(
      `/admin/announcements/${announcementId}`,
      { title: "Updated" },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("DELETE /admin/announcements — USER cannot delete (403)", async () => {
    const res = await api.del(`/admin/announcements/${announcementId}`, userToken);
    expect(res.status).toBe(403);
  });
});

// ─── Carousel Items ──────────────────────────────────────────────────────────

describe("Carousel Items", () => {
  let carouselId: string;

  test("POST /admin/carousel-items — admin creates carousel item", async () => {
    const res = await api.post(
      "/admin/carousel-items",
      { title: "Test Carousel" },
      adminToken
    );
    expect(res.status).toBe(201);
    carouselId = (res.body as Record<string, unknown>).id as string;
  });

  test("POST /admin/carousel-items — USER cannot create (403)", async () => {
    const res = await api.post("/admin/carousel-items", { title: "Nope" }, userToken);
    expect(res.status).toBe(403);
  });

  test("POST /admin/carousel-items — MODERATOR cannot create (403)", async () => {
    const res = await api.post("/admin/carousel-items", { title: "Nope" }, modToken);
    expect(res.status).toBe(403);
  });
});

// ─── Venues & Bookings ──────────────────────────────────────────────────────

describe("Venues & Bookings", () => {
  let venueId: string;

  test("POST /admin/venues — admin creates venue", async () => {
    const res = await api.post(
      "/admin/venues",
      { name: "Test Venue", description: "A test venue", capacity: 50 },
      adminToken
    );
    expect(res.status).toBe(201);
    venueId = (res.body as Record<string, unknown>).id as string;
  });

  test("POST /admin/venues — USER cannot create venue (403)", async () => {
    const res = await api.post(
      "/admin/venues",
      { name: "Unauthorized Venue" },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("GET /admin/venues — any authenticated user can list venues", async () => {
    const res = await api.get("/admin/venues", userToken);
    expect(res.status).toBe(200);
  });

  test("POST /admin/venues/:id/bookings — admin creates booking", async () => {
    const res = await api.post(
      `/admin/venues/${venueId}/bookings`,
      {
        title: "Test Booking",
        startAt: "2026-06-01T10:00:00Z",
        endAt: "2026-06-01T12:00:00Z",
      },
      adminToken
    );
    expect(res.status).toBe(201);
  });

  test("POST /admin/venues/:id/bookings — USER cannot create booking (403)", async () => {
    const res = await api.post(
      `/admin/venues/${venueId}/bookings`,
      {
        title: "User Booking",
        startAt: "2026-07-01T10:00:00Z",
        endAt: "2026-07-01T12:00:00Z",
      },
      userToken
    );
    expect(res.status).toBe(403);
  });

  test("POST /admin/venues/:id/bookings — MODERATOR cannot create booking (403)", async () => {
    const res = await api.post(
      `/admin/venues/${venueId}/bookings`,
      {
        title: "Mod Booking",
        startAt: "2026-08-01T10:00:00Z",
        endAt: "2026-08-01T12:00:00Z",
      },
      modToken
    );
    expect(res.status).toBe(403);
  });
});
