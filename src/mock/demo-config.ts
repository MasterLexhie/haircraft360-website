/**
 * TEMPORARY demo login, kept only until Milestone 2 replaces it with real admin
 * accounts (hashed passwords, database sessions, 2FA). Not production security.
 * Services, settings and sample data now live in the database (see prisma/seed.ts).
 */
export const DEMO_ADMIN = {
  email: "owner@demo.haircraft360.test",
  password: "demo-owner-2026",
  displayName: "Salon owner (demo)",
};
