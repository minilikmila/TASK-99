/**
 * Unit tests — Log redaction behavior
 *
 * Verifies that the production logger's maskFields/maskIp functions
 * correctly redact sensitive fields before they reach log output.
 *
 * Imports the actual production implementation to prevent test/source divergence.
 */

import { maskIp, maskFields } from "../src/lib/mask";

// ─── Redaction tests ─────────────────────────────────────────────────────────

describe("Log field redaction", () => {
  test("password field is redacted", () => {
    const result = maskFields({ password: "secret123" });
    expect(result.password).toBe("[REDACTED]");
  });

  test("passwordHash field is redacted", () => {
    const result = maskFields({ passwordHash: "$2b$12$hash..." });
    expect(result.passwordHash).toBe("[REDACTED]");
  });

  test("authorization header is redacted", () => {
    const result = maskFields({ authorization: "Bearer eyJhbGciOi..." });
    expect(result.authorization).toBe("[REDACTED]");
  });

  test("token field is redacted", () => {
    const result = maskFields({ token: "eyJhbGciOiJIUz..." });
    expect(result.token).toBe("[REDACTED]");
  });

  test("email field is redacted", () => {
    const result = maskFields({ email: "user@example.com" });
    expect(result.email).toBe("[REDACTED]");
  });

  test("secret field is redacted", () => {
    const result = maskFields({ secret: "my-secret-key" });
    expect(result.secret).toBe("[REDACTED]");
  });

  test("apiKey field is redacted", () => {
    const result = maskFields({ apiKey: "key-12345" });
    expect(result.apiKey).toBe("[REDACTED]");
  });

  test("x-internal-key is redacted", () => {
    const result = maskFields({ "x-internal-key": "internal-secret" });
    expect(result["x-internal-key"]).toBe("[REDACTED]");
  });

  test("case-insensitive: Authorization is redacted", () => {
    const result = maskFields({ Authorization: "Bearer abc" });
    expect(result.Authorization).toBe("[REDACTED]");
  });
});

describe("IP address masking", () => {
  test("IPv4 address is partially masked", () => {
    const result = maskFields({ ipAddress: "192.168.1.42" });
    expect(result.ipAddress).toBe("192.168.x.x");
  });

  test("IPv4-mapped IPv6 is partially masked", () => {
    const result = maskFields({ ipAddress: "::ffff:10.0.0.1" });
    expect(result.ipAddress).toBe("::ffff:10.0.x.x");
  });

  test("IPv6 is partially masked", () => {
    const result = maskFields({ ip: "2001:db8:85a3::8a2e:370:7334" });
    expect(result.ip).toBe("2001:x:x:x:x:x:x:x");
  });

  test("remoteAddress key is masked", () => {
    const result = maskFields({ remoteAddress: "10.0.0.5" });
    expect(result.remoteAddress).toBe("10.0.x.x");
  });

  test("clientIp key is masked", () => {
    const result = maskFields({ clientIp: "172.16.0.1" });
    expect(result.clientIp).toBe("172.16.x.x");
  });
});

describe("Nested object redaction", () => {
  test("redacts fields inside nested objects", () => {
    const result = maskFields({
      user: { name: "Alice", password: "secret" },
    });
    expect((result.user as Record<string, unknown>).name).toBe("Alice");
    expect((result.user as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  test("deeply nested password is redacted", () => {
    const result = maskFields({
      request: { body: { password: "deep-secret" } },
    });
    const body = (result.request as Record<string, unknown>).body as Record<string, unknown>;
    expect(body.password).toBe("[REDACTED]");
  });
});

describe("Non-sensitive fields are preserved", () => {
  test("normal fields pass through unchanged", () => {
    const result = maskFields({
      method: "POST",
      url: "/api/v1/auth/login",
      status: 200,
      userId: "user-123",
    });
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/api/v1/auth/login");
    expect(result.status).toBe(200);
    expect(result.userId).toBe("user-123");
  });
});

describe("HTTP access log structure", () => {
  test("structured access log entry has auth header redacted and IP masked", () => {
    const logEntry = maskFields({
      method: "POST",
      url: "/api/v1/auth/login",
      status: 401,
      durationMs: 42,
      authorization: "Bearer eyJ...",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0",
    });
    expect(logEntry.authorization).toBe("[REDACTED]");
    expect(logEntry.ipAddress).toBe("192.168.x.x");
    expect(logEntry.method).toBe("POST");
    expect(logEntry.url).toBe("/api/v1/auth/login");
    expect(logEntry.status).toBe(401);
  });
});
