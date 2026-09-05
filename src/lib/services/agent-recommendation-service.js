import prisma from "@/lib/db/prisma";

/**
 * Agent Recommendation Service.
 *
 * Per spec §18: "Intelligent agent assignment is a major NIRNAYA
 * differentiator. Recommendation is NOT the same thing as assignment.
 * AI recommends. Authorized human accepts/assigns."
 *
 * This service computes deterministic, explainable agent recommendations
 * based on ticket context and agent data within the same organization.
 */

// Active workload statuses per spec §18
const WORKLOAD_STATUSES = ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"];

// High-priority statuses for priority-readiness calculation
const HIGH_PRIORITY_TICKETS = ["HIGH", "CRITICAL"];

// Spec §18 weights
const WEIGHTS = {
  department: 0.30,
  categoryExperience: 0.30,
  workload: 0.25,
  priorityReadiness: 0.10,
  historicalExperience: 0.05,
};

/**
 * Normalize a value to 0–1 given a maximum expected value.
 * Values beyond the max are capped at 1.
 */
function normalize(value, max) {
  if (max <= 0) return 0;
  return Math.min(1, value / max);
}

/**
 * Apply diminishing returns using logarithmic scaling.
 * Prevents agents with huge history from dominating.
 * log(1 + count) / log(1 + referenceMax)
 */
function diminishingReturns(count, referenceMax = 100) {
  return Math.min(1, Math.log(1 + count) / Math.log(1 + referenceMax));
}

/**
 * Calculate department match factor.
 * 1.0 if agent belongs to the ticket's department.
 * 0.0 if ticket department is unknown or agent is in different department.
 *
 * @param {string|null} agentDepartmentId
 * @param {string|null} ticketDepartmentId
 * @returns {number} 0 or 1
 */
function departmentMatch(agentDepartmentId, ticketDepartmentId) {
  if (!ticketDepartmentId) return 0;
  return agentDepartmentId === ticketDepartmentId ? 1.0 : 0.0;
}

/**
 * Calculate category experience factor.
 * Based on resolved/closed tickets for the relevant category.
 * Uses diminishing returns per spec §18.
 *
 * @param {number} categoryResolved - Count of resolved/closed tickets in category
 * @returns {number} 0–1
 */
function categoryExperienceFactor(categoryResolved) {
  return diminishingReturns(categoryResolved, 50);
}

/**
 * Calculate workload factor.
 * Lower active workload is better per spec §18.
 * Workload includes ASSIGNED, IN_PROGRESS, WAITING_FOR_USER, REOPENED.
 *
 * @param {number} activeCount - Number of active tickets
 * @returns {number} 0–1 (1 = no active tickets = best)
 */
function workloadFactor(activeCount) {
  // Inverted: fewer active tickets = higher score
  // Reference: 20 active tickets = worst case
  return Math.max(0, 1 - normalize(activeCount, 20));
}

/**
 * Calculate priority readiness factor.
 * For HIGH/CRITICAL tickets: agents with lower active workload
 * get higher readiness.
 * For MEDIUM/LOW tickets: all agents are equally ready.
 *
 * @param {number} activeCount - Agent's active ticket count
 * @param {string} ticketPriority - Ticket priority
 * @returns {number} 0–1
 */
function priorityReadinessFactor(activeCount, ticketPriority) {
  if (ticketPriority !== "HIGH" && ticketPriority !== "CRITICAL") {
    return 1.0; // All agents equally ready for normal priority
  }
  // For HIGH/CRITICAL: readiness inversely related to active workload
  return Math.max(0, 1 - normalize(activeCount, 15));
}

/**
 * Calculate historical experience factor.
 * Based on total resolved/closed tickets across all categories.
 * Uses diminishing returns per spec §18.
 *
 * @param {number} totalResolved - Total resolved/closed tickets
 * @returns {number} 0–1
 */
function historicalExperienceFactor(totalResolved) {
  return diminishingReturns(totalResolved, 100);
}

/**
 * Generate a human-readable explanation for the recommendation.
 */
function generateExplanation(factors, agent, ticket) {
  const parts = [];

  if (factors.department > 0.5) {
    parts.push(`${agent.username} belongs to the ticket's department`);
  } else if (factors.department === 0 && ticket.departmentId) {
    parts.push(`${agent.username} is in a different department`);
  }

  if (factors.categoryExperience > 0.5) {
    parts.push("has strong category experience");
  } else if (factors.categoryExperience > 0.2) {
    parts.push("has some category experience");
  }

  if (factors.workload > 0.7) {
    parts.push("has low active workload");
  } else if (factors.workload < 0.3) {
    parts.push("has high active workload");
  }

  if (factors.priorityReadiness < 0.5 && (ticket.priority === "HIGH" || ticket.priority === "CRITICAL")) {
    parts.push("may be less available for urgent tickets");
  }

  if (parts.length === 0) {
    parts.push(`${agent.username} is an available agent in the same organization`);
  }

  return `Recommended because ${parts.join(", ")}.`;
}

/**
 * Calculate assignment confidence per spec §18 formula.
 *
 * gapRatio = (topScore - runnerUpScore) / max(topScore, 1)
 * base = 0.35 + gapRatio * 0.50
 * Add: candidate-count contribution up to 0.08
 * Add: quality bonus up to 0.05
 * Bound: 0.50 – 0.98
 *
 * Per D-002: formula is implemented exactly as specified, including
 * the 0.50–0.98 bound.
 *
 * @param {number} topScore
 * @param {number} runnerUpScore
 * @param {number} candidateCount
 * @returns {number} Confidence 0.50–0.98
 */
function calculateConfidence(topScore, runnerUpScore, candidateCount) {
  const gapRatio = (topScore - runnerUpScore) / Math.max(topScore, 1);
  let base = 0.35 + gapRatio * 0.50;

  // Candidate-count bonus: up to 0.08 (more candidates = more confidence)
  const candidateBonus = Math.min(0.08, (candidateCount - 1) * 0.01);

  // Quality bonus: up to 0.05 (higher top score = more confidence)
  const qualityBonus = Math.min(0.05, (topScore / 100) * 0.05);

  const final_ = base + candidateBonus + qualityBonus;
  return Math.max(0.50, Math.min(0.98, final_));
}

/**
 * Find eligible agents for a ticket.
 *
 * Per spec §18:
 * - role = AGENT
 * - same organization
 * - ACTIVE status
 * - same department when department is known
 * - if department is unknown, organization agents may be considered
 * - exclude ADMIN
 * - exclude USER
 * - exclude inactive users
 * - exclude cross-organization agents
 * - exclude wrong-department agents when department is known
 *
 * @param {string} organizationId
 * @param {string|null} departmentId - Ticket department (null = any)
 * @returns {Promise<object[]>} Eligible agents with department info
 */
async function findEligibleAgents(organizationId, departmentId) {
  const where = {
    organizationId,
    role: "AGENT",
    status: "ACTIVE",
  };

  // If department is known, restrict to same department
  if (departmentId) {
    where.departmentId = departmentId;
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      email: true,
      departmentId: true,
      department: { select: { name: true } },
    },
    orderBy: { username: "asc" }, // Deterministic ordering
  });
}

/**
 * Calculate workload metrics for multiple agents in a single query.
 * Returns a map of agentId → { activeTickets, highPriorityTickets }.
 *
 * Uses Prisma groupBy to avoid N+1 queries per spec §18.
 *
 * @param {string[]} agentIds
 * @returns {Promise<Map<string, {activeTickets: number, highPriorityTickets: number}>>}
 */
async function calculateWorkloads(agentIds) {
  if (agentIds.length === 0) return new Map();

  // Count active tickets per agent
  const activeWorkloads = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: {
      assignedAgentId: { in: agentIds },
      status: { in: WORKLOAD_STATUSES },
    },
    _count: { id: true },
  });

  // Count high-priority active tickets per agent
  const highPriorityWorkloads = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: {
      assignedAgentId: { in: agentIds },
      status: { in: WORKLOAD_STATUSES },
      priority: { in: HIGH_PRIORITY_TICKETS },
    },
    _count: { id: true },
  });

  const workloadMap = new Map();
  for (const id of agentIds) {
    workloadMap.set(id, { activeTickets: 0, highPriorityTickets: 0 });
  }

  for (const row of activeWorkloads) {
    workloadMap.set(row.assignedAgentId, {
      ...workloadMap.get(row.assignedAgentId),
      activeTickets: row._count.id,
    });
  }

  for (const row of highPriorityWorkloads) {
    workloadMap.set(row.assignedAgentId, {
      ...workloadMap.get(row.assignedAgentId),
      highPriorityTickets: row._count.id,
    });
  }

  return workloadMap;
}

/**
 * Calculate experience metrics for multiple agents.
 * Returns a map of agentId → { categoryResolved, totalResolved }.
 *
 * @param {string[]} agentIds
 * @param {string|null} categoryId - Specific category (null = skip category count)
 * @returns {Promise<Map<string, {categoryResolved: number, totalResolved: number}>>}
 */
async function calculateExperience(agentIds, categoryId) {
  if (agentIds.length === 0) return new Map();

  const resolvedStatuses = ["RESOLVED", "CLOSED"];

  // Total resolved/closed tickets per agent
  const totalResolved = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: {
      assignedAgentId: { in: agentIds },
      status: { in: resolvedStatuses },
    },
    _count: { id: true },
  });

  const experienceMap = new Map();
  for (const id of agentIds) {
    experienceMap.set(id, { categoryResolved: 0, totalResolved: 0 });
  }

  for (const row of totalResolved) {
    experienceMap.set(row.assignedAgentId, {
      ...experienceMap.get(row.assignedAgentId),
      totalResolved: row._count.id,
    });
  }

  // Category-specific resolved tickets per agent
  if (categoryId) {
    const categoryResolved = await prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      where: {
        assignedAgentId: { in: agentIds },
        categoryId,
        status: { in: resolvedStatuses },
      },
      _count: { id: true },
    });

    for (const row of categoryResolved) {
      experienceMap.set(row.assignedAgentId, {
        ...experienceMap.get(row.assignedAgentId),
        categoryResolved: row._count.id,
      });
    }
  }

  return experienceMap;
}

/**
 * Generate ranked agent recommendations for a ticket.
 *
 * Per spec §18: "Recommendation is NOT the same thing as assignment.
 * AI recommends. Authorized human accepts/assigns."
 *
 * @param {string} ticketId
 * @param {object} user - Authenticated user (for org context)
 * @returns {Promise<{recommendations: object[], totalEligibleAgents: number, generatedAt: string}|{error: string}>}
 */
export async function getRecommendations(ticketId, user) {
  try {
    // 1. Fetch ticket with org validation
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      return { error: "Ticket not found" };
    }

    if (ticket.organizationId !== user.organizationId) {
      return { error: "Ticket not found" };
    }

    // 2. Find eligible agents
    const agents = await findEligibleAgents(
      ticket.organizationId,
      ticket.departmentId
    );

    if (agents.length === 0) {
      return {
        recommendations: [],
        totalEligibleAgents: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const agentIds = agents.map((a) => a.id);

    // 3. Fetch workload and experience data
    // Sequential queries for predictable mock behavior in tests
    // and clearer error isolation.
    const workloadMap = await calculateWorkloads(agentIds);
    const experienceMap = await calculateExperience(agentIds, ticket.categoryId);

    // 4. Score each agent
    const scored = agents.map((agent) => {
      const workload = workloadMap.get(agent.id) || { activeTickets: 0, highPriorityTickets: 0 };
      const experience = experienceMap.get(agent.id) || { categoryResolved: 0, totalResolved: 0 };

      const fDept = departmentMatch(agent.departmentId, ticket.departmentId);
      const fCatExp = categoryExperienceFactor(experience.categoryResolved);
      const fWorkload = workloadFactor(workload.activeTickets);
      const fPriority = priorityReadinessFactor(workload.activeTickets, ticket.priority);
      const fHistExp = historicalExperienceFactor(experience.totalResolved);

      const contribution = {
        department: fDept * WEIGHTS.department * 100,
        categoryExperience: fCatExp * WEIGHTS.categoryExperience * 100,
        workload: fWorkload * WEIGHTS.workload * 100,
        priorityReadiness: fPriority * WEIGHTS.priorityReadiness * 100,
        historicalExperience: fHistExp * WEIGHTS.historicalExperience * 100,
      };

      const rawScore =
        contribution.department +
        contribution.categoryExperience +
        contribution.workload +
        contribution.priorityReadiness +
        contribution.historicalExperience;

      return {
        agentId: agent.id,
        username: agent.username,
        email: agent.email,
        department: agent.department?.name || null,
        score: Math.round(rawScore * 100) / 100,
        workload,
        experience: {
          categoryResolved: experience.categoryResolved,
          totalResolved: experience.totalResolved,
        },
        factors: [
          { name: "Department Match", normalized: fDept, weight: WEIGHTS.department, contribution: Math.round(contribution.department * 100) / 100 },
          { name: "Category Experience", normalized: fCatExp, weight: WEIGHTS.categoryExperience, contribution: Math.round(contribution.categoryExperience * 100) / 100 },
          { name: "Workload", normalized: fWorkload, weight: WEIGHTS.workload, contribution: Math.round(contribution.workload * 100) / 100 },
          { name: "Priority Readiness", normalized: fPriority, weight: WEIGHTS.priorityReadiness, contribution: Math.round(contribution.priorityReadiness * 100) / 100 },
          { name: "Historical Experience", normalized: fHistExp, weight: WEIGHTS.historicalExperience, contribution: Math.round(contribution.historicalExperience * 100) / 100 },
        ],
        // Tie-break fields (for deterministic sorting)
        _categoryResolved: experience.categoryResolved,
        _highPriorityTickets: workload.highPriorityTickets,
        _agentId: agent.id,
      };
    });

    // 5. Sort by spec §18 tie-break order:
    //    score desc → category experience desc → workload asc →
    //    high/critical workload asc → stable agent ID asc
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b._categoryResolved !== a._categoryResolved) return b._categoryResolved - a._categoryResolved;
      if (a.workload.activeTickets !== b.workload.activeTickets) return a.workload.activeTickets - b.workload.activeTickets;
      if (a._highPriorityTickets !== b._highPriorityTickets) return a._highPriorityTickets - b._highPriorityTickets;
      return a._agentId.localeCompare(b._agentId);
    });

    // 6. Calculate confidence for top recommendation
    const topScore = scored[0]?.score || 0;
    const runnerUpScore = scored.length > 1 ? scored[1].score : 0;
    const confidence = calculateConfidence(topScore, runnerUpScore, scored.length);

    // 7. Build final output with rank, confidence, explanation, timestamp
    const generatedAt = new Date().toISOString();
    const recommendations = scored.map((s, i) => ({
      agentId: s.agentId,
      username: s.username,
      email: s.email,
      department: s.department,
      score: s.score,
      confidence: i === 0 ? confidence : null,
      workload: s.workload,
      experience: s.experience,
      explanation: generateExplanation(
        {
          department: s.factors[0].normalized,
          categoryExperience: s.factors[1].normalized,
          workload: s.factors[2].normalized,
          priorityReadiness: s.factors[3].normalized,
          historicalExperience: s.factors[4].normalized,
        },
        s,
        ticket
      ),
      factors: s.factors,
      rank: i + 1,
      timestamp: generatedAt,
    }));

    return {
      ticketId,
      recommendations,
      totalEligibleAgents: agents.length,
      generatedAt,
    };
  } catch (err) {
    console.error("Agent recommendation failed:", err.message);
    return { error: "Recommendation failed" };
  }
}
