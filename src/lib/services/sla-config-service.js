import prisma from "@/lib/db/prisma";
import { createSLAConfigSchema, updateSLAConfigSchema } from "@/lib/validation/admin";

export class SLAConfigError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SLAConfigError";
    this.status = status;
  }
}

export async function listSLAConfigs(organizationId) {
  const configs = await prisma.sLAConfiguration.findMany({
    where: { organizationId },
    orderBy: { priority: "asc" },
  });

  return { configs };
}

export async function getSLAConfig(configId, organizationId) {
  const config = await prisma.sLAConfiguration.findUnique({ where: { id: configId } });
  if (!config) {
    throw new SLAConfigError("SLA configuration not found", 404);
  }
  if (config.organizationId !== organizationId) {
    throw new SLAConfigError("SLA configuration not found", 404);
  }
  return config;
}

export async function createSLAConfig(data, organizationId) {
  const parsed = createSLAConfigSchema.parse(data);

  if (parsed.resolutionTimeMinutes < parsed.responseTimeMinutes) {
    throw new SLAConfigError("Resolution time must be greater than or equal to response time", 400);
  }

  const existing = await prisma.sLAConfiguration.findFirst({
    where: { organizationId, priority: parsed.priority },
  });
  if (existing) {
    throw new SLAConfigError("SLA configuration already exists for this priority", 409);
  }

  const config = await prisma.sLAConfiguration.create({
    data: {
      organizationId,
      priority: parsed.priority,
      responseTimeMinutes: parsed.responseTimeMinutes,
      resolutionTimeMinutes: parsed.resolutionTimeMinutes,
    },
  });

  return config;
}

export async function updateSLAConfig(configId, data, organizationId) {
  const parsed = updateSLAConfigSchema.parse(data);

  const existing = await prisma.sLAConfiguration.findUnique({ where: { id: configId } });
  if (!existing) {
    throw new SLAConfigError("SLA configuration not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new SLAConfigError("SLA configuration not found", 404);
  }

  const responseTime = parsed.responseTimeMinutes ?? existing.responseTimeMinutes;
  const resolutionTime = parsed.resolutionTimeMinutes ?? existing.resolutionTimeMinutes;

  if (resolutionTime < responseTime) {
    throw new SLAConfigError("Resolution time must be greater than or equal to response time", 400);
  }

  const config = await prisma.sLAConfiguration.update({
    where: { id: configId },
    data: {
      ...(parsed.responseTimeMinutes !== undefined && { responseTimeMinutes: parsed.responseTimeMinutes }),
      ...(parsed.resolutionTimeMinutes !== undefined && { resolutionTimeMinutes: parsed.resolutionTimeMinutes }),
    },
  });

  return config;
}
