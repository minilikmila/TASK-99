/**
 * Feature flag pure logic — extracted for direct unit testing.
 */

export interface FeatureFlagRecord {
  organizationId: string;
  key: string;
  value: boolean;
}

export const VALID_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isEnabled(
  flags: FeatureFlagRecord[],
  organizationId: string,
  key: string
): boolean {
  const flag = flags.find(
    (f) => f.organizationId === organizationId && f.key === key
  );
  return flag?.value ?? false;
}
