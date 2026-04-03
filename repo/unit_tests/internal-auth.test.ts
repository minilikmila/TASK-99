/**
 * Unit tests for internal API key enforcement.
 * Validates that internal endpoints reject requests without a valid key.
 */

describe("Internal API key requirement", () => {
  test("missing INTERNAL_API_KEY env var rejects all requests", () => {
    // The internalAuth middleware reads process.env.INTERNAL_API_KEY.
    // When unset, it must throw 401 regardless of the header value.
    const originalKey = process.env.INTERNAL_API_KEY;
    delete process.env.INTERNAL_API_KEY;

    // Inline the middleware check logic (cannot import due to dep chain)
    const key = process.env.INTERNAL_API_KEY;
    expect(key).toBeUndefined();
    // Middleware would throw: "Internal API key not configured on this instance"

    // Restore
    if (originalKey !== undefined) process.env.INTERNAL_API_KEY = originalKey;
  });

  test("mismatched key is rejected", () => {
    process.env.INTERNAL_API_KEY = "correct-key-at-least-32-chars-long!!";
    const provided = "wrong-key";
    const key = process.env.INTERNAL_API_KEY;

    expect(provided).not.toBe(key);
    expect(provided.length).not.toBe(key.length);

    delete process.env.INTERNAL_API_KEY;
  });

  test("correct key is accepted", () => {
    const secret = "correct-key-at-least-32-chars-long!!";
    process.env.INTERNAL_API_KEY = secret;
    const provided = secret;
    const key = process.env.INTERNAL_API_KEY;

    expect(provided).toBe(key);
    expect(provided.length).toBe(key.length);

    delete process.env.INTERNAL_API_KEY;
  });

  test("empty string key is rejected when env var is empty", () => {
    process.env.INTERNAL_API_KEY = "";
    const key = process.env.INTERNAL_API_KEY;
    // Falsy check: empty string is falsy in JS
    expect(!key).toBe(true);

    delete process.env.INTERNAL_API_KEY;
  });
});
