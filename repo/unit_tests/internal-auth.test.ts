/**
 * Unit tests for internal API key enforcement.
 * Imports and exercises the production internalAuth middleware directly.
 *
 * Mocks winston (Node 14 incompatible dependency) and log-alert to isolate
 * the middleware under test.
 */

// Set DATABASE_URL before any imports (config/index.ts requires it)
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";

jest.mock("winston", () => {
  const noop = jest.fn();
  // winston.format(fn) returns a callable format transform
  const fmt = jest.fn(() => noop);
  fmt.combine = jest.fn();
  fmt.timestamp = jest.fn();
  fmt.errors = jest.fn();
  fmt.json = jest.fn();
  fmt.colorize = jest.fn();
  fmt.printf = jest.fn();
  const createLogger = jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
  return {
    __esModule: true,
    default: { format: fmt, createLogger, transports: { Console: jest.fn() } },
    format: fmt,
    createLogger,
    transports: { Console: jest.fn() },
  };
});
jest.mock("../src/jobs/log-alert", () => ({
  recordAlertEvent: jest.fn(),
  checkAlertThresholds: jest.fn(),
}));

import { internalAuth } from "../src/middleware/internalAuth";

function mockReq(headers: Record<string, string> = {}) {
  return { headers } as unknown as import("express").Request;
}

function mockRes() {
  return {} as unknown as import("express").Response;
}

describe("Internal API key requirement (production middleware)", () => {
  const originalKey = process.env.INTERNAL_API_KEY;

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.INTERNAL_API_KEY = originalKey;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  test("missing INTERNAL_API_KEY env var rejects all requests", () => {
    delete process.env.INTERNAL_API_KEY;
    expect(() =>
      internalAuth(mockReq({ "x-internal-key": "anything" }), mockRes(), jest.fn())
    ).toThrow(/not configured/);
  });

  test("mismatched key is rejected", () => {
    process.env.INTERNAL_API_KEY = "correct-key-at-least-32-chars-long!!";
    expect(() =>
      internalAuth(mockReq({ "x-internal-key": "wrong-key" }), mockRes(), jest.fn())
    ).toThrow(/Invalid internal API key/);
  });

  test("correct key calls next()", () => {
    const secret = "correct-key-at-least-32-chars-long!!";
    process.env.INTERNAL_API_KEY = secret;
    const next = jest.fn();
    internalAuth(mockReq({ "x-internal-key": secret }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("empty string key is rejected when env var is empty", () => {
    process.env.INTERNAL_API_KEY = "";
    expect(() =>
      internalAuth(mockReq({ "x-internal-key": "" }), mockRes(), jest.fn())
    ).toThrow(/not configured/);
  });

  test("missing header is rejected", () => {
    process.env.INTERNAL_API_KEY = "correct-key-at-least-32-chars-long!!";
    expect(() =>
      internalAuth(mockReq(), mockRes(), jest.fn())
    ).toThrow(/Invalid internal API key/);
  });

  test("length mismatch key is rejected (timing-safe guard)", () => {
    process.env.INTERNAL_API_KEY = "correct-key-at-least-32-chars-long!!";
    expect(() =>
      internalAuth(
        mockReq({ "x-internal-key": "short" }),
        mockRes(),
        jest.fn()
      )
    ).toThrow(/Invalid internal API key/);
  });
});
