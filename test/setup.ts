import { testDatabaseUrl } from "./env";

// Point the app's database client (src/server/db.ts) at the test database before anything imports it.
const url = testDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
