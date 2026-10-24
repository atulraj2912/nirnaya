import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20261025120000_add_employee_profiles/migration.sql",
  ),
  "utf8",
);

describe("employee profile schema", () => {
  it("keeps new profile fields optional for existing users", () => {
    const userModel = schema.match(/model User \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(userModel).toMatch(/fullName\s+String\?/);
    expect(userModel).toMatch(/professionalSummary\s+String\?/);
    expect(userModel).toMatch(/joiningDate\s+DateTime\?/);
    expect(userModel).toMatch(/yearsOfExperience\s+Int\?/);
    expect(userModel).toMatch(/location\s+String\?/);
  });

  it("models skills as organization-scoped relational records", () => {
    expect(schema).toMatch(/enum SkillProficiency \{[\s\S]*?BEGINNER[\s\S]*?EXPERT[\s\S]*?\}/);
    expect(schema).toMatch(/model Skill \{[\s\S]*?organizationId\s+String[\s\S]*?@@unique\(\[organizationId, name\]\)/);
    expect(schema).toMatch(/model AgentSkill \{[\s\S]*?proficiency\s+SkillProficiency[\s\S]*?isPrimary\s+Boolean/);
    expect(schema).toMatch(/@@unique\(\[userId, skillId\]\)/);
    expect(schema).toMatch(/references: \[id, organizationId\]/);
  });

  it("includes a non-destructive migration and does not drop existing tables", () => {
    expect(migration).toMatch(/ALTER TABLE "users"\s+ADD COLUMN "fullName"/);
    expect(migration).toMatch(/CREATE TABLE "skills"/);
    expect(migration).toMatch(/CREATE TABLE "agent_skills"/);
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DROP DATABASE|DELETE FROM/i);
  });
});
