/**
 * Field-level encryption at rest for sensitive data.
 *
 * Uses AES-256-GCM with a key derived from JWT_SECRET (or ENCRYPTION_KEY if set).
 * Each encrypted value gets a unique IV, stored alongside the ciphertext.
 *
 * Format: base64(iv + authTag + ciphertext)
 *
 * Usage:
 *   const encrypted = encryptField("192.168.x.x");
 *   const decrypted = decryptField(encrypted); // "192.168.x.x"
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a stable 256-bit encryption key.
 * Reads ENCRYPTION_KEY first, falls back to JWT_SECRET.
 * Uses SHA-256 to ensure a consistent 32-byte key regardless of input length.
 */
function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ??
    process.env.JWT_SECRET ??
    "dev-encryption-key-fallback";
  return createHash("sha256").update(secret).digest();
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

export function decryptField(encoded: string): string {
  const key = getKey();
  const packed = Buffer.from(encoded, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
