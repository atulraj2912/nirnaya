import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/authz";
import { updateDepartment, DepartmentError } from "@/lib/services/department-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const where = { id, organizationId: user.organizationId };

    const department = await prisma.department.findFirst({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        managerId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        manager: {
          select: { id: true, username: true, fullName: true, email: true },
        },
        users: {
          where: { organizationId: user.organizationId },
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
            status: true,
            designation: true,
            employeeId: true,
          },
          orderBy: [{ role: "asc" }, { username: "asc" }],
        },
        _count: { select: { users: true, tickets: true } },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const ticketWhere = {
      organizationId: user.organizationId,
      departmentId: department.id,
    };
    const [statusGroups, slaBreaches, recentTickets] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["status"],
        where: ticketWhere,
        _count: { _all: true },
      }),
      prisma.ticket.count({
        where: {
          ...ticketWhere,
          OR: [
            { responseSlaStatus: "BREACHED" },
            { resolutionSlaStatus: "BREACHED" },
          ],
        },
      }),
      prisma.ticket.findMany({
        where: ticketWhere,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          responseSlaStatus: true,
          resolutionSlaStatus: true,
          requester: { select: { username: true, fullName: true } },
          assignedAgent: { select: { username: true, fullName: true } },
          category: { select: { name: true } },
        },
      }),
    ]);

    const ticketStats = {
      total: department._count.tickets,
      open: 0,
      assigned: 0,
      inProgress: 0,
      waitingForUser: 0,
      resolved: 0,
      closed: 0,
      reopened: 0,
      slaBreaches,
    };

    const statusKeys = {
      OPEN: "open",
      ASSIGNED: "assigned",
      IN_PROGRESS: "inProgress",
      WAITING_FOR_USER: "waitingForUser",
      RESOLVED: "resolved",
      CLOSED: "closed",
      REOPENED: "reopened",
    };
    for (const group of statusGroups) {
      const key = statusKeys[group.status];
      if (key) ticketStats[key] = group._count._all;
    }

    const activeEmployees = department.users.filter((member) => member.status === "ACTIVE").length;
    const activeAgents = department.users.filter(
      (member) => member.status === "ACTIVE" && member.role === "AGENT"
    ).length;

    return NextResponse.json({
      department: {
        ...department,
        stats: {
          totalEmployees: department.users.length,
          activeEmployees,
          activeAgents,
          ticketStats,
        },
        tickets: recentTickets,
      },
    });
  } catch (error) {
    console.error("Get department details error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateDepartment(id, body, user.organizationId, user.id);
    return NextResponse.json({ department: updated });
  } catch (err) {
    if (err instanceof DepartmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update department error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
