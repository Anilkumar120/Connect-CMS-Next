
import { spawnSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";

const isProductionDeployment =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production";

loadEnvConfig(process.cwd(), false);

function isPostgresUrl(value) {
  return (
    typeof value === "string" &&
    /^postgres(ql)?:\/\//i.test(value)
  );
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);

  const executable =
    process.platform === "win32" ? `${command}.cmd` : command;

  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (isProductionDeployment) {
  console.log("Production deployment detected.");

  if (!isPostgresUrl(process.env.DATABASE_URL)) {
    throw new Error(
      "Production DATABASE_URL must be a valid PostgreSQL URL."
    );
  }

  if (!isPostgresUrl(process.env.PRISMA_DATABASE_URL)) {
    throw new Error(
      "Production PRISMA_DATABASE_URL must be a valid PostgreSQL URL."
    );
  }

  console.log("Applying PostgreSQL migrations...");

  run("npx", [
    "prisma",
    "migrate",
    "deploy",
    "--schema=prisma/postgres/schema.prisma",
  ]);
} else {
  console.log("Local or Preview build: skipping production migrations.");

  if (!isPostgresUrl(process.env.DATABASE_URL)) {
    const postgresUrl = [
      process.env.PRISMA_DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.DATABASE_URL_POOLED,
    ].find(isPostgresUrl);

    if (!postgresUrl) {
      throw new Error(
        "PostgreSQL URL missing. Configure valid PostgreSQL URLs in .env.production.local."
      );
    }

    process.env.DATABASE_URL = postgresUrl;
  }
}

console.log("Generating PostgreSQL Prisma Client...");

run("npx", [
  "prisma",
  "generate",
  "--schema=prisma/postgres/schema.prisma",
]);

console.log("Starting Next.js production build...");

run("npx", ["next", "build"]);
