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
import bcrypt from "bcrypt";

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
 */
async function upsertDepartments(orgId, adminUserId) {
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
      results.push(
        await prisma.department.create({
          data: {
            ...dept,
            organizationId: orgId,
            createdById: adminUserId,
            updatedById: adminUserId,
          },
        })
      );
    }
  }
  return results;
}

/**
 * Upsert users — idempotent by (organizationId, username).
 */
async function upsertUsers(orgId, departments) {
  const adminHash = await hashPassword(SEED_ADMIN_PASSWORD);
  const userHash = await hashPassword("user123");
  const agentHash = await hashPassword("agent123");

  const itsDept = departments.find((d) => d.code === "ITS");
  const netDept = departments.find((d) => d.code === "NET");
  const sweDept = departments.find((d) => d.code === "SWE");

  const userData = [
    {
      username: "admin",
      email: "admin@acme-corp.com",
      passwordHash: adminHash,
      role: "ADMIN",
      departmentId: itsDept.id,
      designation: "IT Director",
    },
    {
      username: "sarah.chen",
      email: "sarah.chen@acme-corp.com",
      passwordHash: agentHash,
      role: "AGENT",
      departmentId: itsDept.id,
      designation: "Senior IT Support Specialist",
    },
    {
      username: "mike.johnson",
      email: "mike.johnson@acme-corp.com",
      passwordHash: agentHash,
      role: "AGENT",
      departmentId: netDept.id,
      designation: "Network Engineer",
    },
    {
      username: "lisa.wang",
      email: "lisa.wang@acme-corp.com",
      passwordHash: agentHash,
      role: "AGENT",
      departmentId: sweDept.id,
      designation: "Software Engineer",
    },
    {
      username: "john.smith",
      email: "john.smith@acme-corp.com",
      passwordHash: userHash,
      role: "USER",
      departmentId: itsDept.id,
      designation: "Business Analyst",
    },
    {
      username: "emma.davis",
      email: "emma.davis@acme-corp.com",
      passwordHash: userHash,
      role: "USER",
      departmentId: netDept.id,
      designation: "Project Manager",
    },
  ];

  const results = [];
  for (const user of userData) {
    const existing = await prisma.user.findFirst({
      where: { organizationId: orgId, username: user.username },
    });

    if (existing) {
      results.push(existing);
    } else {
      results.push(
        await prisma.user.create({
          data: {
            ...user,
            organizationId: orgId,
          },
        })
      );
    }
  }
  return results;
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
  const existingCount = await prisma.ticket.count({
    where: { organizationId: orgId },
  });

  if (existingCount > 0) {
    return []; // Tickets already seeded
  }

  const requester = users.find((u) => u.username === "john.smith");
  const agent1 = users.find((u) => u.username === "sarah.chen");
  const agent2 = users.find((u) => u.username === "mike.johnson");
  const itsDept = departments.find((d) => d.code === "ITS");
  const netDept = departments.find((d) => d.code === "NET");
  const networkCat = categories.find((c) => c.name === "NETWORK");
  const hardwareCat = categories.find((c) => c.name === "HARDWARE");
  const softwareCat = categories.find((c) => c.name === "SOFTWARE");
  const urgentTag = tags.find((t) => t.name === "urgent");

  // Increment the organization ticket counter atomically
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { ticketCounter: { increment: 6 } },
    select: { ticketCounter: true },
  });

  let counter = org.ticketCounter - 6;
  const year = new Date().getFullYear();

  const ticketData = [
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "Cannot connect to office Wi-Fi",
      description:
        "Multiple users on the 3rd floor are unable to connect to the corporate Wi-Fi network. The access point appears to be online but no devices can obtain an IP address. This started happening after the scheduled maintenance window last night.",
      status: "OPEN",
      priority: "HIGH",
      type: "INCIDENT",
      source: "WEB",
      departmentId: netDept.id,
      categoryId: networkCat.id,
      requesterId: requester.id,
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "ON_TRACK",
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "Request for new laptop - development team",
      description:
        "The software engineering team needs 3 new MacBook Pro laptops for the upcoming Q3 project. Current machines are over 4 years old and cannot run the required development tools efficiently.",
      status: "ASSIGNED",
      priority: "MEDIUM",
      type: "SERVICE_REQUEST",
      source: "WEB",
      departmentId: itsDept.id,
      requesterId: requester.id,
      assignedAgentId: agent1.id,
      responseSlaStatus: "COMPLETED",
      resolutionSlaStatus: "ON_TRACK",
      firstRespondedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "VPN connection drops every 30 minutes",
      description:
        "Remote employees are experiencing VPN disconnections approximately every 30 minutes. This is disrupting video calls and file transfers. The issue affects both Windows and macOS users.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      type: "INCIDENT",
      source: "EMAIL",
      departmentId: netDept.id,
      categoryId: networkCat.id,
      requesterId: users.find((u) => u.username === "emma.davis").id,
      assignedAgentId: agent2.id,
      responseSlaStatus: "COMPLETED",
      resolutionSlaStatus: "WARNING",
      firstRespondedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "Printer on 2nd floor jammed repeatedly",
      description:
        "The HP LaserJet Pro on the 2nd floor near the break room keeps jamming. We've cleared it 5 times today. Paper type is standard A4. Might need maintenance or replacement.",
      status: "RESOLVED",
      priority: "LOW",
      type: "INCIDENT",
      source: "WEB",
      departmentId: itsDept.id,
      categoryId: hardwareCat.id,
      requesterId: requester.id,
      assignedAgentId: agent1.id,
      responseSlaStatus: "COMPLETED",
      resolutionSlaStatus: "COMPLETED",
      firstRespondedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "Outlook not syncing calendar with mobile devices",
      description:
        "Since the Exchange server update last week, calendar changes made on desktop Outlook are not syncing to mobile devices. Email sync works fine. Affecting approximately 15 users across departments.",
      status: "OPEN",
      priority: "MEDIUM",
      type: "INCIDENT",
      source: "API",
      departmentId: itsDept.id,
      categoryId: softwareCat.id,
      requesterId: users.find((u) => u.username === "emma.davis").id,
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "ON_TRACK",
      responseDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      ticketNumber: `NIR-${year}-${String(++counter).padStart(6, "0")}`,
      title: "Request access to restricted database",
      description:
        "I need read-only access to the production analytics database for the quarterly report. My manager (Emma Davis) has approved this request. Database: analytics_prod, Schema: reports.",
      status: "WAITING_FOR_USER",
      priority: "MEDIUM",
      type: "SERVICE_REQUEST",
      source: "WEB",
      departmentId: itsDept.id,
      requesterId: requester.id,
      assignedAgentId: agent1.id,
      responseSlaStatus: "COMPLETED",
      resolutionSlaStatus: "ON_TRACK",
      firstRespondedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      waitingSince: new Date(Date.now() - 6 * 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 36 * 60 * 60 * 1000),
    },
  ];

  const createdTickets = [];
  for (const ticket of ticketData) {
    const created = await prisma.ticket.create({
      data: {
        ...ticket,
        organizationId: orgId,
      },
    });
    createdTickets.push(created);
  }

  // Add tags to first ticket
  if (createdTickets.length > 0 && urgentTag) {
    await prisma.ticketTag.create({
      data: {
        ticketId: createdTickets[0].id,
        tagId: urgentTag.id,
      },
    });
  }

  return createdTickets;
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

  const existingCount = await prisma.comment.count();
  if (existingCount > 0) return; // Already seeded

  const agent1 = users.find((u) => u.username === "sarah.chen");
  const agent2 = users.find((u) => u.username === "mike.johnson");
  const requester = users.find((u) => u.username === "john.smith");
  const emma = users.find((u) => u.username === "emma.davis");

  const commentData = [
    // Comments on ticket 0 (wifi issue)
    {
      ticketId: tickets[0].id,
      authorId: agent1.id,
      content:
        "I've checked the access point logs and it shows DHCP failures. Escalating to network team for investigation.",
      visibility: "PUBLIC",
    },
    {
      ticketId: tickets[0].id,
      authorId: agent1.id,
      content:
        "Internal note: DHCP scope for 3rd floor may be exhausted. Need to check with NET team about scope expansion.",
      visibility: "INTERNAL",
    },
    // Comments on ticket 1 (laptop request)
    {
      ticketId: tickets[1].id,
      authorId: agent1.id,
      content:
        "I've submitted the purchase request to procurement. Expected delivery is 5-7 business days. I'll keep you updated.",
      visibility: "PUBLIC",
    },
    // Comments on ticket 2 (VPN issue)
    {
      ticketId: tickets[2].id,
      authorId: agent2.id,
      content:
        "Initial investigation shows the VPN gateway is restarting due to memory pressure. Looking into the root cause.",
      visibility: "PUBLIC",
    },
    {
      ticketId: tickets[2].id,
      authorId: emma.id,
      content:
        "This is affecting our entire remote team. Please prioritize this issue.",
      visibility: "PUBLIC",
    },
    // Comments on ticket 5 (database access)
    {
      ticketId: tickets[5].id,
      authorId: agent1.id,
      content:
        "I've sent you a temporary access form via email. Please complete it and return it to proceed with the access setup.",
      visibility: "PUBLIC",
    },
  ];

  for (const data of commentData) {
    await prisma.comment.create({ data });
  }
}

/**
 * Create sample assignment history.
 */
async function upsertAssignmentHistory(tickets, users) {
  if (tickets.length === 0) return;

  const existingCount = await prisma.ticketAssignmentHistory.count();
  if (existingCount > 0) return; // Already seeded

  const admin = users.find((u) => u.username === "admin");
  const agent1 = users.find((u) => u.username === "sarah.chen");
  const agent2 = users.find((u) => u.username === "mike.johnson");

  const historyData = [
    {
      ticketId: tickets[1].id,
      assignedToId: agent1.id,
      assignedById: admin.id,
      reason: "Hardware procurement specialist",
    },
    {
      ticketId: tickets[2].id,
      assignedToId: agent2.id,
      assignedById: admin.id,
      reason: "Network specialist, VPN infrastructure owner",
    },
    {
      ticketId: tickets[3].id,
      assignedToId: agent1.id,
      assignedById: admin.id,
      reason: "Hardware issues fall under IT support scope",
    },
    {
      ticketId: tickets[5].id,
      assignedToId: agent1.id,
      assignedById: admin.id,
      reason: "Database access requests handled by IT support",
    },
  ];

  for (const data of historyData) {
    await prisma.ticketAssignmentHistory.create({ data });
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

  // 2. Departments
  const departments = await upsertDepartments(org.id, org.id);
  console.log(`  ✓ Departments: ${departments.length} created/found`);

  // 3. Users (need admin user first for createdBy references)
  const users = await upsertUsers(org.id, departments);
  console.log(`  ✓ Users: ${users.length} created/found`);

  // Update departments with admin as createdBy if they don't have it
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
  console.log(`  ✓ Tickets: ${tickets.length} created/found`);

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
