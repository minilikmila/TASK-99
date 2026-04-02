import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { config } from "./config";
import { logger } from "./lib/logger";
import { startScheduler } from "./jobs/scheduler";
import { validateStartupConfig } from "./lib/startup";

try {
  validateStartupConfig(process.env);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

async function main(): Promise<void> {
  // Verify database connectivity on startup
  await prisma.$connect();
  logger.info("Database connection established");

  startScheduler();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`CivicForum Operations Platform started`, {
      port: config.port,
      env: config.env,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Database disconnected. Goodbye.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
