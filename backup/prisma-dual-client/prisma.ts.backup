
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const CURRENT_SCHEMA_VERSION = "20261113161125_add_payments";
const existingClient = globalForPrisma.prisma;
const hasCurrentSchema =
  globalForPrisma.prismaSchemaVersion === CURRENT_SCHEMA_VERSION &&
  existingClient &&
  typeof existingClient.post !== "undefined" &&
  typeof existingClient.customPostType !== "undefined";

export const prisma =
  hasCurrentSchema ? existingClient : new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = CURRENT_SCHEMA_VERSION;
}
