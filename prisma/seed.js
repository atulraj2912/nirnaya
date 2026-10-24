/**
 * NIRNAYA — Database seed script
 *
 * Idempotent and safe to run repeatedly (spec §28).
 * Creates a realistic demo organization with departments, users,
 * categories, tags, SLA configuration, and sample tickets.
 *
 * Usage: npx prisma db seed
 *   or: node prisma/seed.js
 *
 * Environment:
 *   SEED_ADMIN_PASSWORD — password for the bootstrap admin user
 *                         (default: "admin123" for development only)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";
const SALT_ROUNDS = 10;

// ============================================================
// Helpers
// ============================================================

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Upsert an organization by slug — idempotent.
 */
async function upsertOrganization() {
  return prisma.organization.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corporation",
      slug: "acme-corp",
      description:
        "A global technology company specializing in enterprise solutions.",
      timezone: "America/New_York",
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
    },
  });
}

/**
 * Upsert departments — idempotent by (organizationId, name).
 * Uses raw SQL for initial creation to avoid Prisma input type ambiguity
 * when createdById is nullable. The main() function updates createdBy
 * after users exist.
 */
async function upsertDepartments(orgId) {
  const departments = [
    { name: "IT Support", code: "ITS" },
    { name: "Network Operations", code: "NET" },
    { name: "Software Engineering", code: "SWE" },
    { name: "Human Resources", code: "HR" },
    { name: "Finance", code: "FIN" },
  ];

  const results = [];
  for (const dept of departments) {
    const existing = await prisma.department.findFirst({
      where: { organizationId: orgId, name: dept.name },
    });

    if (existing) {
      results.push(existing);
    } else {
      await prisma.$executeRaw`
        INSERT INTO departments (id, name, code, "organizationId", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${dept.name}, ${dept.code}, ${orgId}, true, NOW(), NOW())
        ON CONFLICT ("organizationId", "name") DO NOTHING
      `;
      const created = await prisma.department.findFirst({
        where: { organizationId: orgId, name: dept.name },
      });
      results.push(created);
    }
  }
  return results;
}

/**
 * Upsert users — idempotent by (organizationId, username).
 */
/**
 * Seed 100 fictional employee accounts with realistic profiles.
 * Existing seeded users are updated only with profile/department metadata;
 * existing password hashes and unrelated user settings are preserved.
 */
async function upsertUsers(orgId, departments) {
  const adminHash = await hashPassword(SEED_ADMIN_PASSWORD);
  const userHash = await hashPassword("user123");
  const agentHash = await hashPassword("agent123");

  const deptByCode = Object.fromEntries(departments.map((d) => [d.code, d]));
  const existingProfiles = [
    {
      username: "admin", email: "admin@acme-corp.com", role: "ADMIN", departmentCode: "ITS",
      designation: "IT Director", fullName: "Alexandra Morgan",
      professionalSummary: "IT director overseeing service delivery, endpoint standards, identity governance, and internal technology operations.",
      joiningDate: "2018-04-16", yearsOfExperience: 14, location: "New York, NY", employeeId: "ACM-0001",
    },
    {
      username: "sarah.chen", email: "sarah.chen@acme-corp.com", role: "AGENT", departmentCode: "ITS",
      designation: "Senior IT Support Specialist", fullName: "Sarah Chen",
      professionalSummary: "Senior service desk specialist experienced in endpoint troubleshooting, Microsoft 365, identity access, and employee onboarding.",
      joiningDate: "2020-02-10", yearsOfExperience: 8, location: "New York, NY", employeeId: "ACM-0002",
    },
    {
      username: "mike.johnson", email: "mike.johnson@acme-corp.com", role: "AGENT", departmentCode: "NET",
      designation: "Network Engineer", fullName: "Michael Johnson",
      professionalSummary: "Network engineer focused on corporate LAN/WAN, wireless connectivity, VPN reliability, and network monitoring.",
      joiningDate: "2019-08-19", yearsOfExperience: 9, location: "Austin, TX", employeeId: "ACM-0003",
    },
    {
      username: "lisa.wang", email: "lisa.wang@acme-corp.com", role: "AGENT", departmentCode: "SWE",
      designation: "Software Support Engineer", fullName: "Lisa Wang",
      professionalSummary: "Application support engineer experienced in debugging internal web applications, developer tooling, and database connectivity.",
      joiningDate: "2021-06-07", yearsOfExperience: 6, location: "Seattle, WA", employeeId: "ACM-0004",
    },
    {
      username: "john.smith", email: "john.smith@acme-corp.com", role: "USER", departmentCode: "FIN",
      designation: "Business Analyst", fullName: "John Smith",
      professionalSummary: "Finance business analyst supporting reporting, reconciliation, spreadsheet workflows, and planning applications.",
      joiningDate: "2022-01-24", yearsOfExperience: 5, location: "New York, NY", employeeId: "ACM-0005",
    },
    {
      username: "emma.davis", email: "emma.davis@acme-corp.com", role: "USER", departmentCode: "HR",
      designation: "Project Manager", fullName: "Emma Davis",
      professionalSummary: "People operations project manager coordinating HR systems, employee lifecycle processes, and cross-functional delivery.",
      joiningDate: "2021-11-15", yearsOfExperience: 7, location: "Chicago, IL", employeeId: "ACM-0006",
    },
  ];

  const extraAgents = [
    ["priya.shah", "Priya Shah", "priya.shah@acme-corp.com", "NET", "Network & VPN Specialist", "2020-09-14", 7, "Austin, TX", "ACM-0007",
      "Specializes in VPN clients, DNS/DHCP troubleshooting, wireless access, and network incident triage."],
    ["daniel.brooks", "Daniel Brooks", "daniel.brooks@acme-corp.com", "ITS", "Endpoint Systems Engineer", "2019-03-04", 10, "New York, NY", "ACM-0008",
      "Experienced with Windows endpoint management, device provisioning, patching, and hardware lifecycle support."],
    ["omar.hassan", "Omar Hassan", "omar.hassan@acme-corp.com", "SWE", "Database & Application Support Engineer", "2022-05-23", 6, "Seattle, WA", "ACM-0009",
      "Supports internal business applications, SQL troubleshooting, access requests, and production incident diagnosis."],
    ["grace.miller", "Grace Miller", "grace.miller@acme-corp.com", "ITS", "Identity & Microsoft 365 Specialist", "2021-02-01", 8, "Chicago, IL", "ACM-0010",
      "Focuses on identity lifecycle, Microsoft 365, email collaboration, MFA support, and access governance."],
    ["ethan.wilson", "Ethan Wilson", "ethan.wilson@acme-corp.com", "NET", "Infrastructure & Security Analyst", "2023-01-09", 5, "Austin, TX", "ACM-0011",
      "Handles server health checks, Linux basics, security triage, log analysis, and infrastructure monitoring."],
  ].map(([username, fullName, email, departmentCode, designation, joiningDate, yearsOfExperience, location, employeeId, professionalSummary]) => ({
    username, fullName, email, role: "AGENT", departmentCode, designation, joiningDate,
    yearsOfExperience, location, employeeId, professionalSummary,
  }));

  const firstNames = [
    "Olivia","Noah","Ava","Liam","Sophia","Mason","Isabella","Ethan","Mia","Lucas",
    "Amelia","Logan","Harper","Elijah","Evelyn","James","Abigail","Benjamin","Ella","Henry",
    "Scarlett","Alexander","Grace","Daniel","Chloe","Matthew","Lily","Samuel","Aria","Jackson",
    "Zoe","David","Nora","Joseph","Riley","Owen","Layla","Gabriel","Hannah","Julian",
    "Leah","Wyatt","Stella","Isaac","Natalie","Anthony","Audrey","Dylan","Claire","Andrew",
    "Violet","Christopher","Lucy","Nathan","Paisley","Ryan","Naomi","Caleb","Elena","Adrian",
    "Maya","Aaron","Sophie","Thomas","Eva","Charles","Aaliyah","Jonathan","Ruby","Nicholas",
    "Ivy","Leo","Sarah","Miles","Madeline","Connor","Ariana","Jeremiah","Julia","Cameron",
    "Alice","Parker","Kennedy","Ian","Vivian","Jordan","Eliza","Dominic","Autumn","Max",
    "Lydia","Theo","Sienna","Peter","Camila","Marcus","Brooke","Rafael","Diana","Victor",
  ];
  const lastNames = [
    "Patel","Reed","Kim","Turner","Garcia","Bennett","Foster","Rivera","Murphy","Cooper",
    "Bailey","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James",
    "Watson","Brooks","Kelly","Sanders","Price","Ross","Henderson","Coleman","Jenkins","Perry",
    "Powell","Long","Patterson","Hughes","Flores","Washington","Butler","Simmons","Fisher","Graham",
    "Barnes","Hamilton","Ford","Gibson","West","Woods","Cole","Stone","Murray","Owens",
    "Holmes","Webb","Hunter","Knight","Wells","Dunn","Spencer","Arnold","Porter","Lawson",
    "Franklin","Bishop","Carr","Holland","Barker","Ferguson","Nichols","Grant","Hawkins","Dixon",
    "Crawford","Boyd","Mason","Kennedy","Warren","Fox","Chapman","Hunt","Black","Palmer",
    "Mills","Stephens","Payne","Pearson","Holland","Johnston","Meyer","Schmidt","Sharma","Kapoor",
  ];
  const employeeRoles = [
    { departmentCode: "FIN", designation: "Financial Analyst", summary: "Works on monthly close, financial reporting, spreadsheet models, and secure access to finance systems." },
    { departmentCode: "HR", designation: "People Operations Specialist", summary: "Supports employee onboarding, HR information systems, benefits workflows, and people reporting." },
    { departmentCode: "SWE", designation: "Software Engineer", summary: "Uses source control, development environments, CI pipelines, and internal engineering applications." },
    { departmentCode: "ITS", designation: "Business Operations Analyst", summary: "Coordinates internal workflows and relies on endpoint, collaboration, and business application tools." },
    { departmentCode: "NET", designation: "Operations Coordinator", summary: "Works across distributed teams and depends on reliable network, VPN, and collaboration access." },
    { departmentCode: "FIN", designation: "Accounts Specialist", summary: "Handles accounts payable/receivable workflows, reconciliations, reporting tools, and controlled financial data access." },
    { departmentCode: "HR", designation: "Talent Acquisition Partner", summary: "Uses recruiting systems, video meetings, document collaboration, and employee data tools." },
    { departmentCode: "SWE", designation: "QA Engineer", summary: "Tests internal applications and needs stable test environments, issue tracking, and development tool access." },
    { departmentCode: "ITS", designation: "Project Coordinator", summary: "Manages project schedules, shared documents, meeting tools, and cross-department communications." },
  ];
  const locations = ["New York, NY", "Austin, TX", "Seattle, WA", "Chicago, IL", "Boston, MA", "Denver, CO"];
  const extraUsers = [];

  // 89 additional regular employees: together with the 2 existing users = 91 USERs.
  for (let i = 0; i < 89; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[(i * 7 + 3) % lastNames.length];
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
    const username = `${base}${i >= firstNames.length ? i + 1 : ""}`;
    const roleInfo = employeeRoles[i % employeeRoles.length];
    const joiningYear = 2019 + (i % 7);
    const joiningMonth = 1 + (i % 12);
    const joiningDay = 1 + ((i * 3) % 27);
    extraUsers.push({
      username,
      fullName: `${first} ${last}`,
      email: `${username}@acme-corp.com`,
      role: "USER",
      departmentCode: roleInfo.departmentCode,
      designation: roleInfo.designation,
      professionalSummary: roleInfo.summary,
      joiningDate: `${joiningYear}-${String(joiningMonth).padStart(2, "0")}-${String(joiningDay).padStart(2, "0")}`,
      yearsOfExperience: 1 + (i % 15),
      location: locations[i % locations.length],
      employeeId: `ACM-${String(i + 12).padStart(4, "0")}`,
    });
  }

  const allProfiles = [...existingProfiles, ...extraAgents, ...extraUsers];
  if (allProfiles.length !== 100) {
    throw new Error(`Expected 100 employee profiles, got ${allProfiles.length}`);
  }

  const results = [];
  for (const profile of allProfiles) {
    const department = deptByCode[profile.departmentCode];
    if (!department) throw new Error(`Missing department ${profile.departmentCode}`);

    const existing = await prisma.user.findFirst({
      where: { organizationId: orgId, username: profile.username },
    });

    const joiningDate = new Date(`${profile.joiningDate}T12:00:00.000Z`);
    const commonData = {
      username: profile.username,
      email: profile.email,
      employeeId: profile.employeeId,
      role: profile.role,
      departmentId: department.id,
      designation: profile.designation,
      fullName: profile.fullName,
      professionalSummary: profile.professionalSummary,
      joiningDate,
      yearsOfExperience: profile.yearsOfExperience,
      location: profile.location,
    };

    if (existing) {
      // Keep the existing password hash and account status intact.
      results.push(await prisma.user.update({
        where: { id: existing.id },
        data: commonData,
      }));
    } else {
      results.push(await prisma.user.create({
        data: {
          ...commonData,
          passwordHash: profile.role === "ADMIN" ? adminHash : profile.role === "AGENT" ? agentHash : userHash,
          organizationId: orgId,
          status: "ACTIVE",
        },
      }));
    }
  }

  return results;
}

async function upsertAgentSkills(orgId, users) {
  const skillDefinitions = [
    ["Windows Endpoint Management", "Windows device provisioning, patching, and troubleshooting."],
    ["Hardware Diagnostics", "Laptop, desktop, printer, and peripheral diagnostics."],
    ["Microsoft 365", "Outlook, Teams, SharePoint, and Microsoft 365 administration."],
    ["Identity and Access Management", "Account lifecycle, access control, MFA, and identity troubleshooting."],
    ["Networking", "LAN/WAN, routing, switching, DNS, DHCP, and network incident diagnosis."],
    ["VPN Troubleshooting", "Remote access clients, VPN gateways, and connectivity diagnosis."],
    ["Linux Administration", "Linux system administration, services, logs, and shell troubleshooting."],
    ["Cloud Infrastructure", "Cloud-hosted infrastructure, monitoring, and operational troubleshooting."],
    ["Cybersecurity Triage", "Security incident triage, log review, and access-risk investigation."],
    ["SQL and Databases", "SQL troubleshooting, database connectivity, and access management."],
    ["Application Support", "Internal business application diagnosis and incident resolution."],
    ["Developer Tooling", "Source control, CI pipelines, IDEs, and development environment support."],
    ["Email Systems", "Mail flow, mailbox configuration, calendar, and synchronization issues."],
    ["IT Service Management", "Incident triage, service requests, ticket workflows, and escalation."],
  ];

  const skillMap = new Map();
  for (const [name, description] of skillDefinitions) {
    const skill = await prisma.skill.upsert({
      where: { organizationId_name: { organizationId: orgId, name } },
      update: { description },
      create: { organizationId: orgId, name, description },
    });
    skillMap.set(name, skill);
  }

  const assignments = {
    "sarah.chen": [
      ["Windows Endpoint Management", "EXPERT", 6, true],
      ["Hardware Diagnostics", "ADVANCED", 5, false],
      ["Microsoft 365", "ADVANCED", 4, false],
      ["IT Service Management", "EXPERT", 6, false],
      ["Identity and Access Management", "INTERMEDIATE", 3, false],
    ],
    "mike.johnson": [
      ["Networking", "EXPERT", 7, true],
      ["VPN Troubleshooting", "EXPERT", 6, false],
      ["Cloud Infrastructure", "INTERMEDIATE", 3, false],
      ["Cybersecurity Triage", "INTERMEDIATE", 2, false],
    ],
    "lisa.wang": [
      ["Application Support", "ADVANCED", 4, true],
      ["SQL and Databases", "ADVANCED", 4, false],
      ["Developer Tooling", "ADVANCED", 5, false],
      ["Linux Administration", "INTERMEDIATE", 2, false],
    ],
    "priya.shah": [
      ["VPN Troubleshooting", "EXPERT", 5, true],
      ["Networking", "ADVANCED", 5, false],
      ["Cybersecurity Triage", "INTERMEDIATE", 2, false],
    ],
    "daniel.brooks": [
      ["Windows Endpoint Management", "EXPERT", 8, true],
      ["Hardware Diagnostics", "EXPERT", 7, false],
      ["IT Service Management", "ADVANCED", 5, false],
    ],
    "omar.hassan": [
      ["SQL and Databases", "EXPERT", 5, true],
      ["Application Support", "ADVANCED", 4, false],
      ["Linux Administration", "INTERMEDIATE", 2, false],
    ],
    "grace.miller": [
      ["Microsoft 365", "EXPERT", 6, true],
      ["Identity and Access Management", "EXPERT", 5, false],
      ["Email Systems", "ADVANCED", 5, false],
    ],
    "ethan.wilson": [
      ["Linux Administration", "ADVANCED", 4, true],
      ["Cloud Infrastructure", "INTERMEDIATE", 3, false],
      ["Cybersecurity Triage", "ADVANCED", 3, false],
      ["Networking", "INTERMEDIATE", 2, false],
    ],
  };

  const agentUsers = users.filter((user) => user.role === "AGENT");
  for (const agent of agentUsers) {
    const skillList = assignments[agent.username] || [["IT Service Management", "INTERMEDIATE", 1, true]];
    for (const [skillName, proficiency, yearsOfExperience, isPrimary] of skillList) {
      const skill = skillMap.get(skillName);
      await prisma.agentSkill.upsert({
        where: { userId_skillId: { userId: agent.id, skillId: skill.id } },
        update: { organizationId: orgId, proficiency, yearsOfExperience, isPrimary },
        create: {
          userId: agent.id,
          skillId: skill.id,
          organizationId: orgId,
          proficiency,
          yearsOfExperience,
          isPrimary,
          notes: `${proficiency.toLowerCase()} proficiency based on the employee's fictional professional profile.`,
        },
      });
    }
  }

  return { skills: skillMap.size, agents: agentUsers.length };
}

/**
 * Upsert categories — idempotent by (organizationId, name).
 */
async function upsertCategories(orgId) {
  const categoryNames = [
    "NETWORK",
    "HARDWARE",
    "SOFTWARE",
    "EMAIL",
    "ACCOUNT",
    "DATABASE",
    "SECURITY",
    "INFRASTRUCTURE",
  ];

  const results = [];
  for (const name of categoryNames) {
    const existing = await prisma.category.findFirst({
      where: { organizationId: orgId, name },
    });

    if (existing) {
      results.push(existing);
    } else {
      results.push(
        await prisma.category.create({
          data: { name, organizationId: orgId },
        })
      );
    }
  }
  return results;
}

/**
 * Upsert tags — idempotent by (organizationId, name).
 */
async function upsertTags(orgId) {
  const tagNames = [
    "urgent",
    "recurring",
    "security-risk",
    "user-error",
    "hardware-failure",
    "software-bug",
    "needs-follow-up",
    "escalated",
  ];

  const results = [];
  for (const name of tagNames) {
    const existing = await prisma.tag.findFirst({
      where: { organizationId: orgId, name },
    });

    if (existing) {
      results.push(existing);
    } else {
      results.push(
        await prisma.tag.create({
          data: { name, organizationId: orgId },
        })
      );
    }
  }
  return results;
}

/**
 * Upsert SLA configurations — idempotent by (organizationId, priority).
 */
async function upsertSLAConfigurations(orgId) {
  const configs = [
    { priority: "LOW", responseTimeMinutes: 480, resolutionTimeMinutes: 2880 },
    { priority: "MEDIUM", responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
    { priority: "HIGH", responseTimeMinutes: 60, resolutionTimeMinutes: 480 },
    { priority: "CRITICAL", responseTimeMinutes: 15, resolutionTimeMinutes: 240 },
  ];

  const results = [];
  for (const config of configs) {
    const existing = await prisma.sLAConfiguration.findFirst({
      where: { organizationId: orgId, priority: config.priority },
    });

    if (existing) {
      results.push(existing);
    } else {
      results.push(
        await prisma.sLAConfiguration.create({
          data: { ...config, organizationId: orgId },
        })
      );
    }
  }
  return results;
}

/**
 * Create a ticket with a generated ticket number.
 * Uses atomic counter increment on Organization.
 */
async function createTicket(orgId, data, orgCounter) {
  const year = new Date().getFullYear();
  const ticketNumber = `NIR-${year}-${String(orgCounter).padStart(6, "0")}`;

  return prisma.ticket.create({
    data: {
      ...data,
      ticketNumber,
      organizationId: orgId,
    },
  });
}

/**
 * Upsert sample tickets — only if none exist for this organization.
 */
async function upsertTickets(orgId, users, departments, categories, tags) {
  // Keep the organization's total ticket dataset near 300 without deleting any existing records.
  const existingTotalCount = await prisma.ticket.count({ where: { organizationId: orgId } });
  const existingDemoCount = await prisma.ticket.count({
    where: { organizationId: orgId, title: { contains: "(DEMO-" } },
  });
  const existingNonDemoCount = existingTotalCount - existingDemoCount;
  const targetCount = Math.max(0, 300 - existingNonDemoCount);
  const admin = users.find((u) => u.username === "admin");
  const agents = users.filter((u) => u.role === "AGENT");
  const requesters = users.filter((u) => u.role === "USER");
  const departmentByCode = Object.fromEntries(departments.map((d) => [d.code, d]));
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const tagByName = Object.fromEntries(tags.map((t) => [t.name, t]));
  if (!admin || agents.length !== 8 || requesters.length < 20) {
    throw new Error("Ticket seed requires admin, eight agents, and the employee user dataset.");
  }

  const scenarios = [
    {
      title: "VPN client disconnects during video calls",
      description: "My VPN disconnects every 20–30 minutes, usually during Teams calls. Reconnecting works temporarily, but file shares and internal tools become unavailable until I reconnect.",
      category: "NETWORK", department: "NET", priority: "HIGH", type: "INCIDENT", skill: "VPN Troubleshooting",
      publicComment: "I reproduced the disconnect and am checking the VPN client logs alongside the gateway session records.",
      internalComment: "Compare the client version and gateway logs around the reported disconnect window before changing configuration.",
    },
    {
      title: "Laptop battery drains unusually quickly",
      description: "The laptop battery has dropped from a full charge to around 20% in less than two hours over the last three days. The device also gets warm while idle.",
      category: "HARDWARE", department: "ITS", priority: "MEDIUM", type: "INCIDENT", skill: "Hardware Diagnostics",
      publicComment: "I will review the battery health report and arrange a device check if the capacity is below the supported threshold.",
      internalComment: "Check battery cycle count, firmware, and background process activity before recommending replacement.",
    },
    {
      title: "Request access to the finance reporting workspace",
      description: "I need read access to the finance reporting workspace to prepare the monthly variance review. Please confirm the correct access group and approval path.",
      category: "ACCOUNT", department: "ITS", priority: "MEDIUM", type: "SERVICE_REQUEST", skill: "Identity and Access Management",
      publicComment: "Please attach or reference the manager approval so we can grant the least-privilege access required.",
      internalComment: "Verify requester department and approval before adding the account to the reporting group.",
    },
    {
      title: "Outlook search returns incomplete results",
      description: "Outlook search is missing messages that are visible when I browse the mailbox manually. Restarting Outlook did not change the results.",
      category: "EMAIL", department: "ITS", priority: "MEDIUM", type: "INCIDENT", skill: "Email Systems",
      publicComment: "I am checking whether the issue is limited to the local search index or also occurs in webmail.",
      internalComment: "Compare web and desktop search, then rebuild the local index only if the server-side results are correct.",
    },
    {
      title: "Development environment cannot reach package registry",
      description: "Package installation from the approved registry times out on the office network, while existing cached dependencies still build successfully.",
      category: "SOFTWARE", department: "SWE", priority: "HIGH", type: "INCIDENT", skill: "Developer Tooling",
      publicComment: "I am checking registry reachability, proxy settings, and whether the failure affects other engineering machines.",
      internalComment: "Capture the registry hostname and request ID; do not bypass the approved package source.",
    },
    {
      title: "Database connection rejected for reporting job",
      description: "The scheduled reporting job started failing with a connection authorization error after the team rotated its service credentials. Interactive access is also affected.",
      category: "DATABASE", department: "SWE", priority: "HIGH", type: "INCIDENT", skill: "SQL and Databases",
      publicComment: "I will verify the service account permissions and confirm that the job is using the current approved credential reference.",
      internalComment: "Do not request or paste secrets into the ticket. Check vault reference, role grants, and audit logs.",
    },
    {
      title: "Request installation of approved design software",
      description: "Please install the approved design application on my assigned workstation. I need it for a cross-functional review next week.",
      category: "SOFTWARE", department: "ITS", priority: "LOW", type: "SERVICE_REQUEST", skill: "Windows Endpoint Management",
      publicComment: "I have checked the software catalogue and will confirm compatibility with your assigned device.",
      internalComment: "Confirm licence availability and software catalogue approval before deployment.",
    },
    {
      title: "Repeated Wi-Fi drops in conference room",
      description: "Several people in the west conference room lose Wi-Fi for a few minutes at a time. Wired desks nearby appear unaffected.",
      category: "NETWORK", department: "NET", priority: "MEDIUM", type: "INCIDENT", skill: "Networking",
      publicComment: "We will compare access-point telemetry with the reported times and check whether roaming or interference is involved.",
      internalComment: "Check AP client counts, channel utilization, and DHCP logs before changing radio settings.",
    },
    {
      title: "Request read-only access to analytics database",
      description: "For the quarterly operations review, I need read-only access to the approved analytics schema. No write permissions are required.",
      category: "DATABASE", department: "SWE", priority: "MEDIUM", type: "SERVICE_REQUEST", skill: "SQL and Databases",
      publicComment: "Please provide the approved access request or manager confirmation so we can proceed with read-only permissions.",
      internalComment: "Validate business justification and apply the narrowest database role that meets the request.",
    },
    {
      title: "Suspicious MFA prompts after password change",
      description: "I received several MFA prompts that I did not initiate after changing my password. I denied them and have not approved any unfamiliar sign-in.",
      category: "SECURITY", department: "ITS", priority: "CRITICAL", type: "INCIDENT", skill: "Cybersecurity Triage",
      publicComment: "Thanks for reporting this promptly. Please do not approve unexpected prompts; the security team is reviewing sign-in activity.",
      internalComment: "Treat as a potential account compromise. Review identity logs and follow the incident response playbook; do not include sensitive tokens.",
    },
    {
      title: "Linux build runner reports low disk space",
      description: "The shared build runner is failing jobs because the workspace volume is nearly full. Recent builds are slower and some jobs terminate during artifact creation.",
      category: "INFRASTRUCTURE", department: "SWE", priority: "HIGH", type: "INCIDENT", skill: "Linux Administration",
      publicComment: "I am reviewing disk usage and runner logs to identify safe cleanup candidates before expanding storage.",
      internalComment: "Check retained artifacts and active workspaces; avoid deleting data required by running jobs.",
    },
    {
      title: "New starter needs laptop and account setup",
      description: "A new colleague joins next Monday and needs a managed laptop, standard collaboration tools, and access to the team's approved applications.",
      category: "HARDWARE", department: "ITS", priority: "MEDIUM", type: "SERVICE_REQUEST", skill: "Windows Endpoint Management",
      publicComment: "We will coordinate device provisioning and confirm the approved access list with the hiring manager.",
      internalComment: "Use the onboarding checklist; verify asset inventory and approvals before assigning licences or permissions.",
    },
    {
      title: "Microsoft Teams microphone unavailable",
      description: "Teams no longer detects my headset microphone after a recent operating-system update. The headset works in another conferencing application.",
      category: "SOFTWARE", department: "ITS", priority: "LOW", type: "INCIDENT", skill: "Microsoft 365",
      publicComment: "Please confirm whether the headset appears in operating-system sound settings; I will check Teams device permissions next.",
      internalComment: "Check driver and privacy settings before reinstalling the collaboration client.",
    },
    {
      title: "Cloud dashboard shows intermittent service errors",
      description: "The internal cloud operations dashboard intermittently returns gateway errors, but refreshing usually loads the page. The issue began this morning.",
      category: "INFRASTRUCTURE", department: "NET", priority: "HIGH", type: "INCIDENT", skill: "Cloud Infrastructure",
      publicComment: "I am correlating the error times with service health and gateway metrics to determine the affected component.",
      internalComment: "Check service health, gateway error rates, and recent deployment changes; preserve correlation IDs.",
    },
    {
      title: "Request access to source repository",
      description: "I have joined the application maintenance rotation and need read access to the team's repository and issue board. Write access is not needed yet.",
      category: "ACCOUNT", department: "SWE", priority: "LOW", type: "SERVICE_REQUEST", skill: "Identity and Access Management",
      publicComment: "Please confirm the repository name and manager approval; we will grant the minimum required role.",
      internalComment: "Verify team membership and least-privilege access before changing repository permissions.",
    },
  ];

  const statuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "REOPENED"];
  const sources = ["WEB", "WEB", "WEB", "EMAIL", "API"];
  const fixedNow = new Date("2026-10-25T12:00:00.000Z");
  const plan = [];

  for (let i = 0; i < targetCount; i++) {
    const scenario = scenarios[i % scenarios.length];
    const requester = requesters[(i * 17 + 5) % requesters.length];
    const category = categoryByName[scenario.category];
    const department = departmentByCode[scenario.department];
    const preferredAgents = agents.filter((agent) => {
      const skillNames = {
        "VPN Troubleshooting": ["mike.johnson", "priya.shah"],
        "Hardware Diagnostics": ["sarah.chen", "daniel.brooks"],
        "Identity and Access Management": ["grace.miller", "sarah.chen"],
        "Email Systems": ["grace.miller"],
        "Developer Tooling": ["lisa.wang"],
        "SQL and Databases": ["omar.hassan", "lisa.wang"],
        "Windows Endpoint Management": ["daniel.brooks", "sarah.chen"],
        "Networking": ["mike.johnson", "priya.shah"],
        "Cybersecurity Triage": ["ethan.wilson", "mike.johnson"],
        "Linux Administration": ["ethan.wilson", "lisa.wang"],
        "Microsoft 365": ["grace.miller", "sarah.chen"],
        "Cloud Infrastructure": ["mike.johnson", "ethan.wilson"],
      };
      return (skillNames[scenario.skill] || []).includes(agent.username);
    });
    const candidateAgents = preferredAgents.length ? preferredAgents : agents;
    const agent = candidateAgents[i % candidateAgents.length];
    const status = statuses[(i * 5 + Math.floor(i / 11)) % statuses.length];
    const priority = i % 37 === 0 ? "CRITICAL" : (i % 5 === 0 ? scenario.priority : ["LOW", "MEDIUM", "HIGH"][i % 3]);
    const ageDays = 1 + ((i * 13) % 210);
    const createdAt = new Date(fixedNow.getTime() - ageDays * 24 * 60 * 60 * 1000 - (i % 8) * 60 * 60 * 1000);
    const slaMinutes = { LOW: 480, MEDIUM: 240, HIGH: 60, CRITICAL: 15 }[priority];
    const resolutionMinutes = { LOW: 2880, MEDIUM: 1440, HIGH: 480, CRITICAL: 240 }[priority];
    const hasResponse = status !== "OPEN";
    const firstRespondedAt = hasResponse
      ? new Date(createdAt.getTime() + Math.min(slaMinutes * 0.6, 180) * 60 * 1000)
      : null;
    let resolvedAt = null;
    let closedAt = null;
    if (status === "RESOLVED" || status === "CLOSED" || status === "REOPENED") {
      const resolutionDelay = (2 + (i % 40)) * 60 * 60 * 1000;
      resolvedAt = new Date(createdAt.getTime() + resolutionDelay);
      if (status === "CLOSED") closedAt = new Date(resolvedAt.getTime() + (2 + (i % 72)) * 60 * 60 * 1000);
    }
    const waitingSince = status === "WAITING_FOR_USER"
      ? new Date(Math.max(createdAt.getTime() + 60 * 60 * 1000, fixedNow.getTime() - (i % 3 + 1) * 60 * 60 * 1000))
      : null;
    const responseSlaStatus = !hasResponse
      ? (fixedNow.getTime() > createdAt.getTime() + slaMinutes * 60000 ? "BREACHED" : "ON_TRACK")
      : (firstRespondedAt.getTime() <= createdAt.getTime() + slaMinutes * 60000 ? "COMPLETED" : "BREACHED");
    const resolutionSlaStatus = resolvedAt
      ? (resolvedAt.getTime() <= createdAt.getTime() + resolutionMinutes * 60000 ? "COMPLETED" : "BREACHED")
      : (status === "WAITING_FOR_USER" ? "PAUSED" : (fixedNow.getTime() > createdAt.getTime() + resolutionMinutes * 60000 ? "BREACHED" : "ON_TRACK"));

    // Stable ticket identity lets repeated seed runs find these exact demo records.
    const seedKey = `DEMO-${String(i + 1).padStart(3, "0")}`;
    const title = `${scenario.title} (${seedKey})`;
    const description = `${scenario.description}\n\nDemo reference: ${seedKey}. This is fictional training data for the NIRNAYA demonstration environment.`;
    const existing = await prisma.ticket.findFirst({
      where: { organizationId: orgId, title, requesterId: requester.id, createdById: admin.id },
    });

    plan.push({
      existing,
      seedKey,
      scenario,
      requester,
      agent,
      category,
      department,
      title,
      description,
      priority,
      status,
      source: sources[i % sources.length],
      createdAt,
      updatedAt: new Date(Math.min(fixedNow.getTime(), Math.max(
        createdAt.getTime() + 45 * 60 * 1000,
        (closedAt || resolvedAt || firstRespondedAt || createdAt).getTime()
      ))),
      firstRespondedAt,
      resolvedAt,
      closedAt,
      waitingSince,
      responseDueAt: new Date(createdAt.getTime() + slaMinutes * 60000),
      resolutionDueAt: new Date(createdAt.getTime() + resolutionMinutes * 60000),
      responseSlaStatus,
      resolutionSlaStatus,
    });
  }

  const missing = plan.filter((p) => !p.existing);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ticketCounter: true },
  });
  const currentYear = new Date().getFullYear();
  const existingNumbers = await prisma.ticket.findMany({
    where: { organizationId: orgId, ticketNumber: { startsWith: `NIR-${currentYear}-` } },
    select: { ticketNumber: true },
  });
  const maxExistingNumber = existingNumbers.reduce((max, row) => {
    const match = row.ticketNumber.match(new RegExp(`^NIR-${currentYear}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let counter = Math.max(org.ticketCounter || 0, maxExistingNumber);
  if (missing.length > 0) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { ticketCounter: counter + missing.length },
    });
  }

  const seededTickets = [];
  for (const item of plan) {
    if (item.existing) {
      seededTickets.push(item.existing);
      continue;
    }
    counter += 1;
    const created = await prisma.ticket.create({
      data: {
        ticketNumber: `NIR-${currentYear}-${String(counter).padStart(6, "0")}`,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        type: item.scenario.type,
        source: item.source,
        organizationId: orgId,
        departmentId: item.department.id,
        categoryId: item.category?.id || null,
        requesterId: item.requester.id,
        assignedAgentId: item.status === "OPEN" ? null : item.agent.id,
        createdById: admin.id,
        updatedById: admin.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        responseSlaStatus: item.responseSlaStatus,
        resolutionSlaStatus: item.resolutionSlaStatus,
        responseDueAt: item.responseDueAt,
        resolutionDueAt: item.resolutionDueAt,
        firstRespondedAt: item.firstRespondedAt,
        waitingSince: item.waitingSince,
        resolvedAt: item.resolvedAt,
        closedAt: item.closedAt,
      },
    });
    seededTickets.push(created);
  }

  // Seed a relevant tag per ticket and avoid duplicate join rows.
  for (let i = 0; i < seededTickets.length; i++) {
    const ticket = seededTickets[i];
    const item = plan[i];
    const tagName = item.priority === "CRITICAL" ? "security-risk"
      : (item.priority === "HIGH" ? "urgent"
      : (item.scenario.type === "SERVICE_REQUEST" ? "needs-follow-up" : "recurring"));
    const tag = tagByName[tagName];
    if (tag) {
      await prisma.ticketTag.upsert({
        where: { ticketId_tagId: { ticketId: ticket.id, tagId: tag.id } },
        update: {},
        create: { ticketId: ticket.id, tagId: tag.id },
      });
    }
  }

  return seededTickets;
}
/**
 * Create sample watchers.
 */
async function upsertWatchers(tickets, users) {
  if (tickets.length === 0) return;

  const watcherData = [
    { ticketId: tickets[0].id, userId: users[0].id }, // admin watches wifi issue
    { ticketId: tickets[0].id, userId: users[4].id }, // requester watches own ticket
    { ticketId: tickets[2].id, userId: users[5].id }, // emma watches her VPN ticket
  ];

  for (const data of watcherData) {
    const existing = await prisma.watcher.findUnique({
      where: { ticketId_userId: data },
    });

    if (!existing) {
      await prisma.watcher.create({ data });
    }
  }
}

/**
 * Create sample comments on tickets.
 */
async function upsertComments(tickets, users) {
  if (tickets.length === 0) return;
  const admin = users.find((u) => u.username === "admin");
  const agentById = new Map(users.filter((u) => u.role === "AGENT").map((u) => [u.id, u]));
  const demoTickets = tickets.filter((ticket) => ticket.title.includes("(DEMO-"));
  for (const ticket of demoTickets) {
    const assignedAgent = ticket.assignedAgentId ? agentById.get(ticket.assignedAgentId) : null;
    const requesterId = ticket.requesterId;
    const publicAuthorId = assignedAgent?.id || requesterId;
    const baseTime = new Date(ticket.createdAt);
    const publicTime = new Date(Math.min(Date.now(), baseTime.getTime() + 30 * 60 * 1000));
    const publicContent = assignedAgent
      ? "I have started investigating this request and am checking the relevant device, account, or service logs. I will share the next update once the initial checks are complete."
      : "Adding a note with the times this happened and the steps already tried. The issue is still reproducible.";
    const comments = [{
      ticketId: ticket.id,
      authorId: publicAuthorId,
      visibility: "PUBLIC",
      content: publicContent,
      createdAt: publicTime,
    }];
    if (assignedAgent) {
      comments.push({
        ticketId: ticket.id,
        authorId: assignedAgent.id,
        visibility: "INTERNAL",
        content: "Internal triage: verify the reported scope, check relevant logs, and record the diagnostic result before making a configuration change.",
        createdAt: new Date(Math.min(Date.now(), baseTime.getTime() + 45 * 60 * 1000)),
      });
    }
    for (const comment of comments) {
      const existing = await prisma.comment.findFirst({
        where: {
          ticketId: comment.ticketId,
          authorId: comment.authorId,
          visibility: comment.visibility,
          content: comment.content,
          createdAt: comment.createdAt,
        },
      });
      if (!existing) await prisma.comment.create({ data: comment });
    }
  }
}
/**
 * Create sample assignment history.
 */
async function upsertAssignmentHistory(tickets, users) {
  if (tickets.length === 0) return;
  const admin = users.find((u) => u.username === "admin");
  const agents = users.filter((u) => u.role === "AGENT");
  for (const ticket of tickets.filter((t) => t.title.includes("(DEMO-") && t.assignedAgentId)) {
    const assignedAt = new Date(new Date(ticket.createdAt).getTime() + 10 * 60 * 1000);
    const initialHistory = {
      ticketId: ticket.id,
      assignedToId: ticket.assignedAgentId,
      assignedById: admin.id,
      reason: "Assigned based on technical specialization and current service-desk coverage.",
      createdAt: assignedAt,
    };
    const existing = await prisma.ticketAssignmentHistory.findFirst({
      where: initialHistory,
    });
    if (!existing) {
      await prisma.ticketAssignmentHistory.create({ data: initialHistory });
    }

    // A small proportion of tickets have a realistic handoff recorded as an additional history row.
    const match = ticket.title.match(/DEMO-(\d+)/);
    const sequence = match ? Number(match[1]) : 0;
    if (sequence > 0 && sequence % 9 === 0 && agents.length > 1) {
      const alternate = agents.find((agent) => agent.id !== ticket.assignedAgentId);
      const handoff = {
        ticketId: ticket.id,
        assignedToId: alternate.id,
        assignedById: admin.id,
        reason: "Reassigned after initial triage identified a more suitable technical specialist.",
        createdAt: new Date(assignedAt.getTime() + 2 * 60 * 60 * 1000),
      };
      const found = await prisma.ticketAssignmentHistory.findFirst({ where: handoff });
      if (!found) await prisma.ticketAssignmentHistory.create({ data: handoff });
    }
  }
}
/**
 * Create sample saved replies.
 */
async function upsertSavedReplies(orgId, adminUserId) {
  const existingCount = await prisma.savedReply.count({
    where: { organizationId: orgId },
  });

  if (existingCount > 0) return; // Already seeded

  const replies = [
    {
      title: "Ticket Received",
      content:
        "Thank you for contacting IT Support. We have received your request and assigned it ticket number {TICKET_NUMBER}. Our team will review your issue and respond within the SLA timeframe.",
      organizationId: orgId,
      createdById: adminUserId,
    },
    {
      title: "Password Reset Instructions",
      content:
        "To reset your password, please visit the password reset portal at https://password.acme-corp.com. If you continue to experience issues, please contact us with your employee ID.",
      organizationId: orgId,
      createdById: adminUserId,
    },
    {
      title: "VPN Troubleshooting Steps",
      content:
        "Please try the following steps:\n1. Restart your computer\n2. Uninstall and reinstall the VPN client\n3. Check if your home router needs a firmware update\n4. Try connecting from a different network\nIf the issue persists, please provide your IP address and VPN client version.",
      organizationId: orgId,
      createdById: adminUserId,
    },
  ];

  for (const data of replies) {
    await prisma.savedReply.create({ data });
  }
}

// ============================================================
// Main seed function
// ============================================================

async function main() {
  console.log("🌱 Starting NIRNAYA database seed...");

  // 1. Organization
  const org = await upsertOrganization();
  console.log(`  ✓ Organization: ${org.name} (${org.id})`);

  // 2. Departments (created with null createdById — no users exist yet)
  const departments = await upsertDepartments(org.id);
  console.log(`  ✓ Departments: ${departments.length} created/found`);

  // 3. Users (need departments to exist for departmentId references)
  const users = await upsertUsers(org.id, departments);
  console.log(`  ✓ Users: ${users.length} created/found`);

  // 3a. Structured technical skills for all eight agents
  const skillSummary = await upsertAgentSkills(org.id, users);
  console.log(`  ✓ Skills: ${skillSummary.skills} created/found; agent profiles: ${skillSummary.agents}`);

  // 4. Update departments with admin as createdBy/updatedBy
  const admin = users.find((u) => u.username === "admin");
  for (const dept of departments) {
    if (dept.createdById !== admin.id) {
      await prisma.department.update({
        where: { id: dept.id },
        data: { createdById: admin.id, updatedById: admin.id },
      });
    }
  }

  // 4. Categories
  const categories = await upsertCategories(org.id);
  console.log(`  ✓ Categories: ${categories.length} created/found`);

  // 5. Tags
  const tags = await upsertTags(org.id);
  console.log(`  ✓ Tags: ${tags.length} created/found`);

  // 6. SLA Configurations
  const slaConfigs = await upsertSLAConfigurations(org.id);
  console.log(`  ✓ SLA Configurations: ${slaConfigs.length} created/found`);

  // 7. Tickets
  const tickets = await upsertTickets(org.id, users, departments, categories, tags);
  console.log(`  ✓ Demo tickets: ${tickets.length} created/found (target: 300)`);

  // 8. Watchers
  await upsertWatchers(tickets, users);
  console.log(`  ✓ Watchers: created/found`);

  // 9. Comments
  await upsertComments(tickets, users);
  console.log(`  ✓ Comments: created/found`);

  // 10. Assignment History
  await upsertAssignmentHistory(tickets, users);
  console.log(`  ✓ Assignment History: created/found`);

  // 11. Saved Replies
  await upsertSavedReplies(org.id, admin.id);
  console.log(`  ✓ Saved Replies: created/found`);

  console.log("\n✅ Seed completed successfully.");
  console.log("\nTest credentials (development only):");
  console.log("  Admin: admin@acme-corp.com / " + SEED_ADMIN_PASSWORD);
  console.log("  Agent: sarah.chen@acme-corp.com / agent123");
  console.log("  User:  john.smith@acme-corp.com / user123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
