import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./env";

/** Brings the test database up to the latest migration once per run. */
export default function setup() {
  const url = testDatabaseUrl();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
  });
}
