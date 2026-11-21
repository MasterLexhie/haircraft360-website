import { describe, expect, it } from "vitest";
import { pgConfig } from "@/lib/pg-adapter";

const remote = "postgresql://postgres.abc:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

describe("database connection settings", () => {
  it("asks a local database for UTC", () => {
    expect(pgConfig("postgresql://postgres@localhost:5432/dev", PEM)).toEqual({ connectionString: "postgresql://postgres@localhost:5432/dev", options: "-c timezone=UTC" });
  });

  it("leaves a remote URL alone without a CA certificate", () => {
    expect(pgConfig(remote, undefined)).toEqual({ connectionString: remote });
    expect(pgConfig(remote, "  ")).toEqual({ connectionString: remote });
  });

  it("checks the server certificate when a CA is given, dropping SSL settings from the URL", () => {
    const c = pgConfig(remote, PEM);
    expect(c.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    const url = new URL(c.connectionString!);
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.password).toBe("secret");
  });

  it("accepts a certificate pasted with escaped line breaks", () => {
    expect(pgConfig(remote, PEM.replace(/\n/g, "\\n")).ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });
});
