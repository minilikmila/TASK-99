/**
 * Unit tests for feature flag logic.
 * Imports production functions from src/lib/feature-flag-rules.ts.
 */

import {
  isEnabled,
  VALID_KEY_PATTERN,
  type FeatureFlagRecord,
} from "../src/lib/feature-flag-rules";

const ORG = "org_a";
const OTHER_ORG = "org_b";

describe("Feature flag: isEnabled (production module)", () => {
  test("flag absent → disabled by default", () => {
    expect(isEnabled([], ORG, "new_editor")).toBe(false);
  });

  test("flag present with value=true → enabled", () => {
    const flags: FeatureFlagRecord[] = [{ organizationId: ORG, key: "new_editor", value: true }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(true);
  });

  test("flag present with value=false → disabled", () => {
    const flags: FeatureFlagRecord[] = [{ organizationId: ORG, key: "new_editor", value: false }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(false);
  });

  test("flag from different org does not bleed over", () => {
    const flags: FeatureFlagRecord[] = [{ organizationId: OTHER_ORG, key: "new_editor", value: true }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(false);
  });
});

// ─── Key format validation ────────────────────────────────────────────────────

describe("Feature flag key validation (production regex)", () => {
  test.each([
    ["new_editor", true],
    ["dark_mode", true],
    ["feature123", true],
    ["a", true],
    ["NewEditor", false],
    ["1feature", false],
    ["feature-flag", false],
    ["", false],
    ["feature flag", false],
  ])('key "%s" valid=%s', (key, expected) => {
    expect(VALID_KEY_PATTERN.test(key)).toBe(expected);
  });
});
