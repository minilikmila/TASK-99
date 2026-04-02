/**
 * Test database seed — creates a deterministic set of users, sections, and
 * supporting data that API tests depend on.
 *
 * Run automatically by scripts/entrypoint.test.sh inside the test container.
 * Safe to re-run: all operations are idempotent upserts.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Fixed IDs / slugs used by API tests ─────────────────────────────────────

export const TEST_ORG_ID   = "test-org-id";
export const TEST_ORG_SLUG = "test-org";

export const USER_IDS = {
  admin:   "test-admin-id",
  mod:     "test-mod-id",
  analyst: "test-analyst-id",
  user1:   "test-user1-id",
  user2:   "test-user2-id",
  target:  "test-target-id",   // reserved for ban/mute tests
} as const;

export const SECTION_IDS = {
  alpha: "ts-section-alpha",
  beta:  "ts-section-beta",
} as const;

// ─── User credential definitions ─────────────────────────────────────────────

const USERS: Array<{
  id: string;
  username: string;
  password: string;
  role: Role;
}> = [
  { id: USER_IDS.admin,   username: "test-admin",   password: "admin-password-secure-1",  role: Role.ADMINISTRATOR },
  { id: USER_IDS.mod,     username: "test-mod",     password: "mod-password-secure-1!",   role: Role.MODERATOR     },
  { id: USER_IDS.analyst, username: "test-analyst", password: "analyst-pass-secure!1",    role: Role.ANALYST       },
  { id: USER_IDS.user1,   username: "test-user1",   password: "user1-password-secure",    role: Role.USER          },
  { id: USER_IDS.user2,   username: "test-user2",   password: "user2-password-secure",    role: Role.USER          },
  { id: USER_IDS.target,  username: "test-target",  password: "target-pass-secure!1",     role: Role.USER          },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[seed-test] Seeding test database...");

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: TEST_ORG_SLUG },
    update: { name: "Test Organization", isActive: true },
    create: { id: TEST_ORG_ID, name: "Test Organization", slug: TEST_ORG_SLUG, isActive: true },
  });
  console.log(`[seed-test] Organization: ${org.slug} (${org.id})`);

  // Users
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10); // cost 10 for speed in tests
    await prisma.user.upsert({
      where: { organizationId_username: { organizationId: org.id, username: u.username } },
      update: { passwordHash, role: u.role, isBanned: false, muteUntil: null },
      create: { id: u.id, organizationId: org.id, username: u.username, passwordHash, role: u.role },
    });
    console.log(`[seed-test] User: ${u.username} (${u.role})`);
  }

  // Sections
  const sections = [
    { id: SECTION_IDS.alpha, name: "Test Section Alpha" },
    { id: SECTION_IDS.beta,  name: "Test Section Beta"  },
  ];

  for (const s of sections) {
    await prisma.section.upsert({
      where: { id: s.id },
      update: { name: s.name },
      create: { id: s.id, organizationId: org.id, name: s.name, description: `${s.name} for testing` },
    });
    console.log(`[seed-test] Section: ${s.name} (${s.id})`);
  }

  // Tags
  const tags = [
    { slug: "test-tech",  name: "Technology" },
    { slug: "test-news",  name: "News"       },
  ];
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: t.slug } },
      update: { name: t.name },
      create: { organizationId: org.id, name: t.name, slug: t.slug },
    });
  }
  console.log(`[seed-test] Tags seeded`);

  // Risk rule thresholds (stored in description field as numeric strings)
  const riskThresholds = [
    { key: "risk.deletion_threshold",      description: "10" },
    { key: "risk.cancellation_threshold",  description: "20" },
    { key: "risk.report_threshold",        description: "5"  },
    { key: "risk.deletion_window_minutes", description: "60" },
    { key: "risk.report_window_minutes",   description: "30" },
  ];
  for (const f of riskThresholds) {
    await prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId: org.id, key: f.key } },
      update: {},
      create: { organizationId: org.id, key: f.key, value: false, description: f.description },
    });
  }
  console.log("[seed-test] Risk threshold flags seeded.");

  console.log("[seed-test] Done.");
}

main()
  .catch((err) => {
    console.error("[seed-test] FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
