
-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'contacted', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('none', 'some', 'working');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'application_received';

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT '',
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptingApplications" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramApplication" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "experience" "ExperienceLevel" NOT NULL,
    "motivation" TEXT NOT NULL,
    "howHeard" TEXT NOT NULL DEFAULT '',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'new',
    "privateNote" TEXT NOT NULL DEFAULT '',
    "statusChangedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProgramApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramApplication_reference_key" ON "ProgramApplication"("reference");

-- CreateIndex
CREATE INDEX "ProgramApplication_status_createdAt_idx" ON "ProgramApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramApplication_programId_idx" ON "ProgramApplication"("programId");

-- CreateIndex
CREATE INDEX "ProgramApplication_phone_idx" ON "ProgramApplication"("phone");

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Same rule as every other table: no access through Supabase's Data API.
ALTER TABLE "Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgramApplication" ENABLE ROW LEVEL SECURITY;
