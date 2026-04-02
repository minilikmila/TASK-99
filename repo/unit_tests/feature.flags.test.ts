/**
 * Unit tests for feature flag logic.
 * Validates key validation, value toggling, and the "absent = disabled" contract.
 */

// ─── Simulated flag store ─────────────────────────────────────────────────────

interface FeatureFlagLike {
  organizationId: string;
  key: string;
  value: boolean;
}

function isEnabled(
  flags: FeatureFlagLike[],
  organizationId: string,
  key: string
): boolean {
  const flag = flags.find(
    (f) => f.organizationId === organizationId && f.key === key
  );
  // Absence is treated as disabled — never throws
  return flag?.value ?? false;
}

function createFlag(
  flags: FeatureFlagLike[],
  organizationId: string,
  key: string,
  value: boolean
): FeatureFlagLike[] {
  const exists = flags.some((f) => f.organizationId === organizationId && f.key === key);
  if (exists) throw new Error(`Flag "${key}" already exists`);
  return [...flags, { organizationId, key, value }];
}

function toggleFlag(
  flags: FeatureFlagLike[],
  organizationId: string,
  key: string,
  value: boolean
): FeatureFlagLike[] {
  const idx = flags.findIndex((f) => f.organizationId === organizationId && f.key === key);
  if (idx === -1) throw new Error(`Flag "${key}" not found`);
  const updated = [...flags];
  updated[idx] = { ...updated[idx], value };
  return updated;
}

const ORG = "org_a";
const OTHER_ORG = "org_b";

describe("Feature flag: isEnabled", () => {
  test("flag absent → disabled by default", () => {
    expect(isEnabled([], ORG, "new_editor")).toBe(false);
  });

  test("flag present with value=true → enabled", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "new_editor", value: true }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(true);
  });

  test("flag present with value=false → disabled", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "new_editor", value: false }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(false);
  });

  test("flag from different org does not bleed over", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: OTHER_ORG, key: "new_editor", value: true }];
    expect(isEnabled(flags, ORG, "new_editor")).toBe(false);
  });
});

describe("Feature flag: create", () => {
  test("creates flag with initial value", () => {
    const flags = createFlag([], ORG, "dark_mode", true);
    expect(isEnabled(flags, ORG, "dark_mode")).toBe(true);
  });

  test("duplicate key within same org throws", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "dark_mode", value: true }];
    expect(() => createFlag(flags, ORG, "dark_mode", false)).toThrow();
  });

  test("same key in different org is allowed", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "dark_mode", value: true }];
    const updated = createFlag(flags, OTHER_ORG, "dark_mode", false);
    expect(updated).toHaveLength(2);
    expect(isEnabled(updated, ORG, "dark_mode")).toBe(true);
    expect(isEnabled(updated, OTHER_ORG, "dark_mode")).toBe(false);
  });
});

describe("Feature flag: toggle", () => {
  test("toggling true→false disables flag", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "beta", value: true }];
    const updated = toggleFlag(flags, ORG, "beta", false);
    expect(isEnabled(updated, ORG, "beta")).toBe(false);
  });

  test("toggling false→true enables flag", () => {
    const flags: FeatureFlagLike[] = [{ organizationId: ORG, key: "beta", value: false }];
    const updated = toggleFlag(flags, ORG, "beta", true);
    expect(isEnabled(updated, ORG, "beta")).toBe(true);
  });

  test("toggling non-existent key throws", () => {
    expect(() => toggleFlag([], ORG, "ghost", true)).toThrow();
  });
});

// ─── Key format validation ────────────────────────────────────────────────────

const VALID_KEY = /^[a-z][a-z0-9_]*$/;

describe("Feature flag key validation", () => {
  test.each([
    ["new_editor", true],
    ["dark_mode", true],
    ["feature123", true],
    ["a", true],
    ["NewEditor", false],     // uppercase not allowed
    ["1feature", false],      // must start with letter
    ["feature-flag", false],  // hyphens not allowed
    ["", false],              // empty
    ["feature flag", false],  // spaces
  ])('key "%s" valid=%s', (key, expected) => {
    expect(VALID_KEY.test(key)).toBe(expected);
  });
});
