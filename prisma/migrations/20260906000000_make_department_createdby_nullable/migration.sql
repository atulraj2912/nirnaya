-- AlterTable: Make Department.createdById nullable
-- This breaks the circular FK dependency during seed/bootstrap:
-- Department.createdById -> User, User.departmentId -> Department

-- Step 1: Drop the existing non-nullable FK constraint
ALTER TABLE "departments" DROP CONSTRAINT "departments_createdById_fkey";

-- Step 2: Make createdById nullable
ALTER TABLE "departments" ALTER COLUMN "createdById" DROP NOT NULL;

-- Step 3: Recreate the FK constraint allowing NULL values
ALTER TABLE "departments" ADD CONSTRAINT "departments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
