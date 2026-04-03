/**
 * Unit tests for field-level encryption at rest.
 * Tests the production encryptField/decryptField from src/lib/encryption.ts.
 */

import { encryptField, decryptField } from "../src/lib/encryption";

describe("Field-level encryption (AES-256-GCM)", () => {
  test("round-trip: encrypt then decrypt returns original plaintext", () => {
    const plaintext = "192.168.x.x";
    const encrypted = encryptField(plaintext);
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test("encrypts email-like values correctly", () => {
    const email = "user@example.com";
    const encrypted = encryptField(email);
    expect(encrypted).not.toBe(email);
    expect(decryptField(encrypted)).toBe(email);
  });

  test("encrypted output is base64 encoded", () => {
    const encrypted = encryptField("test-data");
    expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    // Verify it's not plaintext
    expect(encrypted).not.toContain("test-data");
  });

  test("each encryption produces unique ciphertext (unique IV)", () => {
    const plaintext = "same-value";
    const enc1 = encryptField(plaintext);
    const enc2 = encryptField(plaintext);
    expect(enc1).not.toBe(enc2); // Different IVs → different ciphertext
    expect(decryptField(enc1)).toBe(plaintext);
    expect(decryptField(enc2)).toBe(plaintext);
  });

  test("empty string round-trips correctly", () => {
    const encrypted = encryptField("");
    expect(decryptField(encrypted)).toBe("");
  });

  test("unicode content round-trips correctly", () => {
    const unicode = "IPv6: 2001:x:x:x — masked";
    const encrypted = encryptField(unicode);
    expect(decryptField(encrypted)).toBe(unicode);
  });

  test("tampered ciphertext throws on decrypt", () => {
    const encrypted = encryptField("sensitive-data");
    const tampered = encrypted.slice(0, -4) + "XXXX";
    expect(() => decryptField(tampered)).toThrow();
  });
});
