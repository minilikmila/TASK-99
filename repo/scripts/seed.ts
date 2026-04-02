/**
 * Database seed script — creates a default organization and admin user.
 * Run: npm run seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "default-org" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default-org",
      isActive: true,
    },
  });
  console.log(`Organization: ${org.slug} (${org.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash("admin-password-secure", 12);
  const admin = await prisma.user.upsert({
    where: {
      organizationId_username: {
        organizationId: org.id,
        username: "admin",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      username: "admin",
      passwordHash,
      role: "ADMINISTRATOR",
    },
  });
  console.log(`Admin user: ${admin.username} (${admin.id})`);

  // Create default section
  const section = await prisma.section.upsert({
    where: { id: "default-section" },
    update: {},
    create: {
      id: "default-section",
      organizationId: org.id,
      name: "General Discussion",
      description: "General community forum",
    },
  });
  console.log(`Section: ${section.name} (${section.id})`);

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
  console.log("Risk threshold flags seeded.");

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
