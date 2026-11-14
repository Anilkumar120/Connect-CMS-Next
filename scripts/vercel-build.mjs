
import { spawnSync } from "node:child_process";

const isProductionDeployment =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production";

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
  console.log("Applying PostgreSQL migrations...");

  if (!process.env.DATABASE_URL || !process.env.PRISMA_DATABASE_URL) {
    throw new Error(
      "Production DATABASE_URL or PRISMA_DATABASE_URL is missing."
    );
  }

  run("npx", [
    "prisma",
    "migrate",
    "deploy",
    "--schema=prisma/postgres/schema.prisma",
  ]);
} else {
  console.log("Local or Preview build: skipping production migrations.");
}

console.log("Generating PostgreSQL Prisma Client...");

run("npx", [
  "prisma",
  "generate",
  "--schema=prisma/postgres/schema.prisma",
]);

console.log("Starting Next.js production build...");

run("npx", ["next", "build"]);
