/**
 * Shared test fixtures — credentials and fixed IDs matching seed-test.ts.
 * Import from this module instead of hardcoding values in test files.
 */

export const TEST_ORG = "test-org";

export const CREDS = {
  admin:   { username: "test-admin",   password: "admin-password-secure-1" },
  mod:     { username: "test-mod",     password: "mod-password-secure-1!"  },
  analyst: { username: "test-analyst", password: "analyst-pass-secure!1"   },
  user1:   { username: "test-user1",   password: "user1-password-secure"   },
  user2:   { username: "test-user2",   password: "user2-password-secure"   },
  target:  { username: "test-target",  password: "target-pass-secure!1"    },
} as const;

export const USER_IDS = {
  admin:   "test-admin-id",
  mod:     "test-mod-id",
  analyst: "test-analyst-id",
  user1:   "test-user1-id",
  user2:   "test-user2-id",
  target:  "test-target-id",
} as const;

export const SECTION_IDS = {
  alpha: "ts-section-alpha",
  beta:  "ts-section-beta",
} as const;

// Second organization (for cross-tenant isolation tests)
export const OTHER_ORG = "other-org";
export const OTHER_ORG_CREDS = { username: "other-user", password: "other-password-secure" };
export const OTHER_SECTION_ID = "other-section-id";
export const OTHER_TAG_ID = "other-tag-id";
