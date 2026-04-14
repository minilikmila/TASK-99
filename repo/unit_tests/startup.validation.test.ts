/**
 * Unit tests for startup configuration validation (Fix 2).
 * Verifies that the server refuses to start when secrets are weak in production.
 */

import { validateStartupConfig, PLACEHOLDER_SECRET } from "../src/lib/startup";

const STRONG_SECRET = "a-very-strong-jwt-secret-that-is-32chars";
const STRONG_KEY    = "a-very-strong-internal-key-32chars!!";

describe("validateStartupConfig", () => {
  describe("production environment", () => {
    test("throws when JWT_SECRET is the placeholder value", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: PLACEHOLDER_SECRET,
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("throws when JWT_SECRET is shorter than 32 chars", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: "tooshort",
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("throws when JWT_SECRET is exactly 31 chars (boundary)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: "x".repeat(31),
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("throws when JWT_SECRET is missing", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("throws when INTERNAL_API_KEY is missing even with valid JWT_SECRET", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: STRONG_SECRET,
        })
      ).toThrow(/INTERNAL_API_KEY/);
    });

    test("throws when INTERNAL_API_KEY is shorter than 32 chars", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: STRONG_SECRET,
          INTERNAL_API_KEY: "tooshort",
        })
      ).toThrow(/INTERNAL_API_KEY/);
    });

    test("throws when INTERNAL_API_KEY is exactly 31 chars (boundary)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: STRONG_SECRET,
          INTERNAL_API_KEY: "y".repeat(31),
        })
      ).toThrow(/INTERNAL_API_KEY/);
    });

    test("does NOT throw when both secrets are valid (32+ chars)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: STRONG_SECRET,
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).not.toThrow();
    });

    test("does NOT throw when JWT_SECRET is exactly 32 chars (boundary)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: "x".repeat(32),
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).not.toThrow();
    });

    test("throws when JWT_SECRET is the docker-compose default (local-dev- prefix)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: "local-dev-jwt-secret-change-in-production-32chars-VALID-KEY-0123456789",
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("throws when INTERNAL_API_KEY is the docker-compose default (local-dev- prefix)", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: STRONG_SECRET,
          INTERNAL_API_KEY: "local-dev-internal-api-key-VALID-KEY-0123456789abcdef",
        })
      ).toThrow(/INTERNAL_API_KEY/);
    });

    test("throws when JWT_SECRET starts with dev-secret-", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "production",
          JWT_SECRET: "dev-secret-change-me-this-is-long-enough-32",
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });
  });

  describe("non-production environments", () => {
    test("does NOT throw in development regardless of secret value", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "development",
          JWT_SECRET: "short",
        })
      ).not.toThrow();
    });

    test("does NOT throw in test environment regardless of secret value", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "test",
          JWT_SECRET: PLACEHOLDER_SECRET,
        })
      ).not.toThrow();
    });

    test("defaults to development when NODE_ENV is absent (no throw)", () => {
      expect(() =>
        validateStartupConfig({})
      ).not.toThrow();
    });
  });

  describe("staging / other environments enforce same rules as production", () => {
    test("throws in staging when JWT_SECRET is weak", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "staging",
          JWT_SECRET: "local-dev-weak-secret-that-is-long-enough",
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).toThrow(/JWT_SECRET/);
    });

    test("does NOT throw in staging when both secrets are strong", () => {
      expect(() =>
        validateStartupConfig({
          NODE_ENV: "staging",
          JWT_SECRET: STRONG_SECRET,
          INTERNAL_API_KEY: STRONG_KEY,
        })
      ).not.toThrow();
    });
  });
});
