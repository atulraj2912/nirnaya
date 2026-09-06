import prisma from "@/lib/db/prisma";
import { classify, getConfiguredProviderName } from "@/lib/ai/classifier";

/**
 * AI Classification Service.
 *
 * High-level service that orchestrates ticket classification,
 * prediction persistence, and result retrieval.
 *
 * Per spec §17: "Persist AI prediction history appropriately."
 * Per spec §26: "AI prediction lookup must constrain ticket
 * organization/authorization."
 */

/**
 * Classify a ticket and persist the prediction.
 *
 * This function is designed to be called after ticket creation.
 * It does NOT throw on provider failure — classification is best-effort
 * and a failure must not prevent ticket creation from succeeding.
 *
 * @param {string} ticketId - The ticket to classify
 * @param {object} user - Authenticated user (for org context)
 * @returns {Promise<{prediction: object|null, error: string|null}>}
 */
export async function classifyTicket(ticketId, user) {
  try {
    // Fetch ticket with org validation
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (!ticket) {
      return { prediction: null, error: "Ticket not found" };
    }

    if (ticket.organizationId !== user.organizationId) {
      return { prediction: null, error: "Ticket not found" };
    }

    // Fetch org-scoped categories and departments for the AI provider
    const [orgCategories, orgDepartments] = await Promise.all([
      prisma.category.findMany({
        where: { organizationId: user.organizationId, isActive: true },
        select: { name: true },
      }),
      prisma.department.findMany({
        where: { organizationId: user.organizationId, isActive: true },
        select: { name: true },
      }),
    ]);

    // Build classification input
    const input = {
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      source: ticket.source,
      departmentName: ticket.department?.name || null,
      categoryName: ticket.category?.name || null,
    };

    // Call AI classifier with org-scoped context
    const result = await classify(input, {
      categories: orgCategories.map((c) => c.name),
      departments: orgDepartments.map((d) => d.name),
    });

    // Resolve predicted category to a real Category ID (same org)
    let predictedCategoryId = null;
    if (result.categoryName) {
      const category = await prisma.category.findFirst({
        where: {
          organizationId: user.organizationId,
          name: result.categoryName,
          isActive: true,
        },
      });
      predictedCategoryId = category?.id || null;
    }

    // Resolve predicted department to a real Department ID (same org)
    let predictedDepartmentId = null;
    if (result.departmentName) {
      const department = await prisma.department.findFirst({
        where: {
          organizationId: user.organizationId,
          name: { contains: result.departmentName, mode: "insensitive" },
          isActive: true,
        },
      });
      predictedDepartmentId = department?.id || null;
    }

    // Persist prediction
    const prediction = await prisma.aIPrediction.create({
      data: {
        ticketId,
        predictedCategoryId,
        predictedPriority: result.predictedPriority || null,
        predictedDepartmentId,
        confidence: result.confidence,
        explanation: result.explanation,
        suggestedNextSteps: result.suggestedNextSteps,
      },
    });

    return { prediction, error: null };
  } catch (err) {
    console.error("AI classification failed:", err.message);
    if (err.stack) {
      console.error("AI classification stack:", err.stack.split("\n").slice(0, 3).join("\n"));
    }
    return { prediction: null, error: "Classification failed" };
  }
}

/**
 * Get all AI predictions for a ticket.
 * Organization-scoped.
 *
 * @param {string} ticketId
 * @param {object} user - Authenticated user
 * @returns {Promise<object[]>}
 */
export async function getPredictions(ticketId, user) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { organizationId: true },
  });

  if (!ticket || ticket.organizationId !== user.organizationId) {
    return [];
  }

  const predictions = await prisma.aIPrediction.findMany({
    where: { ticketId },
    include: {
      predictedCategory: { select: { id: true, name: true } },
      predictedDepartment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return predictions;
}

/**
 * Get the latest AI prediction for a ticket.
 *
 * @param {string} ticketId
 * @param {object} user - Authenticated user
 * @returns {Promise<object|null>}
 */
export async function getLatestPrediction(ticketId, user) {
  const predictions = await getPredictions(ticketId, user);
  return predictions[0] || null;
}

/**
 * Apply an AI prediction to a ticket (set category/priority).
 * Only AGENT/ADMIN can apply predictions.
 *
 * Per spec §17: "AI output must be validated before use."
 * Per spec §7: AGENT/ADMIN permissions include AI classification use.
 *
 * @param {string} ticketId
 * @param {string} predictionId
 * @param {object} user - Authenticated user
 * @returns {Promise<{ticket: object|null, error: string|null}>}
 */
export async function applyPrediction(ticketId, predictionId, user) {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket || ticket.organizationId !== user.organizationId) {
      return { ticket: null, error: "Ticket not found" };
    }

    const prediction = await prisma.aIPrediction.findUnique({
      where: { id: predictionId },
    });

    if (!prediction || prediction.ticketId !== ticketId) {
      return { ticket: null, error: "Prediction not found" };
    }

    const updateData = { updatedById: user.id };

    // Validate and apply predicted category (must exist in same org)
    if (prediction.predictedCategoryId) {
      const cat = await prisma.category.findFirst({
        where: {
          id: prediction.predictedCategoryId,
          organizationId: user.organizationId,
          isActive: true,
        },
      });
      if (cat) {
        updateData.categoryId = cat.id;
      }
    }

    // Apply predicted priority (enum value, safe to use directly)
    if (prediction.predictedPriority) {
      updateData.priority = prediction.predictedPriority;
    }

    // Validate and apply predicted department (must exist in same org)
    if (prediction.predictedDepartmentId) {
      const dept = await prisma.department.findFirst({
        where: {
          id: prediction.predictedDepartmentId,
          organizationId: user.organizationId,
          isActive: true,
        },
      });
      if (dept) {
        updateData.departmentId = dept.id;
      }
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        department: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, email: true } },
        assignedAgent: { select: { id: true, username: true, email: true } },
      },
    });

    return { ticket: updated, error: null };
  } catch (err) {
    console.error("Apply prediction failed:", err.message);
    return { ticket: null, error: "Failed to apply prediction" };
  }
}

export { getConfiguredProviderName };
