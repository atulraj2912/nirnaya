import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Phase 1 toolchain smoke test", () => {
  it("health route handler returns an ok status with phase-1", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", phase: "phase-1" });
  });
});
