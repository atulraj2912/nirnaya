import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    sLAConfiguration: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  listSLAConfigs,
  getSLAConfig,
  createSLAConfig,
  updateSLAConfig,
  SLAConfigError,
} from "@/lib/services/sla-config-service";

const orgId = "org-1";

function makeSLAConfig(overrides = {}) {
  return {
    id: "sla-1",
    organizationId: orgId,
    priority: "HIGH",
    responseTimeMinutes: 30,
    resolutionTimeMinutes: 240,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSLAConfigs", () => {
  it("returns configs ordered by priority", async () => {
    prisma.sLAConfiguration.findMany.mockResolvedValue([
      makeSLAConfig({ priority: "CRITICAL" }),
      makeSLAConfig({ id: "sla-2", priority: "HIGH" }),
    ]);

    const result = await listSLAConfigs(orgId);
    expect(result.configs).toHaveLength(2);
    expect(prisma.sLAConfiguration.findMany).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      orderBy: { priority: "asc" },
    });
  });
});

describe("getSLAConfig", () => {
  it("returns config by id", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(makeSLAConfig());
    const result = await getSLAConfig("sla-1", orgId);
    expect(result.priority).toBe("HIGH");
  });

  it("throws for non-existent config", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(null);
    await expect(getSLAConfig("missing", orgId)).rejects.toThrow("SLA configuration not found");
  });

  it("throws for cross-org config", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(makeSLAConfig({ organizationId: "other" }));
    await expect(getSLAConfig("sla-1", orgId)).rejects.toThrow("SLA configuration not found");
  });
});

describe("createSLAConfig", () => {
  it("creates config with valid data", async () => {
    prisma.sLAConfiguration.findFirst.mockResolvedValue(null);
    prisma.sLAConfiguration.create.mockResolvedValue(makeSLAConfig());

    const result = await createSLAConfig(
      { priority: "HIGH", responseTimeMinutes: 30, resolutionTimeMinutes: 240 },
      orgId
    );
    expect(result.priority).toBe("HIGH");
  });

  it("throws if resolution < response", async () => {
    await expect(
      createSLAConfig(
        { priority: "HIGH", responseTimeMinutes: 240, resolutionTimeMinutes: 30 },
        orgId
      )
    ).rejects.toThrow("Resolution time must be greater than or equal to response time");
  });

  it("throws on duplicate priority", async () => {
    prisma.sLAConfiguration.findFirst.mockResolvedValue({ id: "existing" });
    await expect(
      createSLAConfig({ priority: "HIGH", responseTimeMinutes: 30, resolutionTimeMinutes: 240 }, orgId)
    ).rejects.toThrow("SLA configuration already exists for this priority");
  });
});

describe("updateSLAConfig", () => {
  it("updates config fields", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(makeSLAConfig());
    prisma.sLAConfiguration.update.mockResolvedValue(
      makeSLAConfig({ responseTimeMinutes: 60 })
    );

    const result = await updateSLAConfig("sla-1", { responseTimeMinutes: 60 }, orgId);
    expect(result.responseTimeMinutes).toBe(60);
  });

  it("validates resolution >= response on update", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(makeSLAConfig());

    await expect(
      updateSLAConfig("sla-1", { responseTimeMinutes: 500 }, orgId)
    ).rejects.toThrow("Resolution time must be greater than or equal to response time");
  });

  it("throws for non-existent config", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(null);
    await expect(
      updateSLAConfig("missing", { responseTimeMinutes: 10 }, orgId)
    ).rejects.toThrow("SLA configuration not found");
  });

  it("throws for cross-org config", async () => {
    prisma.sLAConfiguration.findUnique.mockResolvedValue(makeSLAConfig({ organizationId: "other" }));
    await expect(
      updateSLAConfig("sla-1", { responseTimeMinutes: 10 }, orgId)
    ).rejects.toThrow("SLA configuration not found");
  });
});
