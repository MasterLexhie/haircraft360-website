import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma's CLI does not read Next.js env files, so load them here.
// .env.local wins over .env, matching Next.js precedence.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations use the direct connection; the app uses DATABASE_URL (pooled in production).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
