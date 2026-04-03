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

  // All operational config (DB-driven)
  const allConfigs = [
    { key: "forum.max_pinned_per_section",     description: "3"   },
    { key: "forum.max_reply_depth",            description: "3"   },
    { key: "forum.recycle_bin_retention_days",  description: "30"  },
    { key: "forum.bulk_action_max_items",       description: "100" },
    { key: "forum.mute_duration_min_hours",     description: "24"  },
    { key: "forum.mute_duration_max_hours",     description: "720" },
    { key: "auth.lockout_attempts",            description: "5"   },
    { key: "auth.lockout_window_minutes",      description: "15"  },
    { key: "rate_limit.writes_per_min",        description: "120" },
    { key: "rate_limit.reads_per_min",         description: "600" },
    { key: "notification.max_retries",         description: "3"   },
    { key: "notification.retry_delay_1_min",   description: "1"   },
    { key: "notification.retry_delay_2_min",   description: "5"   },
    { key: "notification.retry_delay_3_min",   description: "30"  },
    { key: "notification.retry_window_hours",  description: "24"  },
    { key: "backup.retention_days",            description: "14"  },
  ];
  for (const f of allConfigs) {
    await prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId: org.id, key: f.key } },
      update: { description: f.description },
      create: { organizationId: org.id, key: f.key, value: true, description: f.description },
    });
  }
  console.log("All operational config flags seeded.");

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
