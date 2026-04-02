/**
 * API integration test for the health endpoint.
 *
 * Requires a running server (or supertest-style setup).
 * This file demonstrates the expected contract.
 */

import { BASE_URL } from "./helpers/client";

describe("GET /api/v1/health", () => {
  test("returns 200 with JSON status", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(body.services).toBeDefined();
  });

  test("response includes X-Correlation-Id header", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  test("forwards provided correlation ID", async () => {
    const cid = "test-correlation-id-12345";
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      headers: { "X-Correlation-Id": cid },
    });
    expect(res.headers.get("x-correlation-id")).toBe(cid);
  });
});
