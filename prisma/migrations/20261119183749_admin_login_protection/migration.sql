-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastTotpStep" INTEGER,
ADD COLUMN     "loginBlockedUntil" TIMESTAMPTZ(3);
