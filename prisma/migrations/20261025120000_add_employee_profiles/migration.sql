-- Add optional employee profile details without changing existing account behavior.
ALTER TABLE "users"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "professionalSummary" TEXT,
  ADD COLUMN "joiningDate" DATE,
  ADD COLUMN "yearsOfExperience" INTEGER,
  ADD COLUMN "location" TEXT;

-- Structured organization-scoped technical skills and agent proficiency.
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

CREATE TABLE "skills" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_skills" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
  "yearsOfExperience" INTEGER,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skills_organizationId_name_key" ON "skills"("organizationId", "name");
CREATE UNIQUE INDEX "skills_id_organizationId_key" ON "skills"("id", "organizationId");
CREATE UNIQUE INDEX "users_id_organizationId_key" ON "users"("id", "organizationId");
CREATE INDEX "skills_organizationId_idx" ON "skills"("organizationId");
CREATE UNIQUE INDEX "agent_skills_userId_skillId_key" ON "agent_skills"("userId", "skillId");
CREATE INDEX "agent_skills_userId_idx" ON "agent_skills"("userId");
CREATE INDEX "agent_skills_skillId_idx" ON "agent_skills"("skillId");

ALTER TABLE "skills" ADD CONSTRAINT "skills_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_userId_organizationId_fkey"
  FOREIGN KEY ("userId", "organizationId") REFERENCES "users"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skillId_organizationId_fkey"
  FOREIGN KEY ("skillId", "organizationId") REFERENCES "skills"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
