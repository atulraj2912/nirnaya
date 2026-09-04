import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Phase 0 toolchain smoke test", () => {
  it("health route handler returns an ok status", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", phase: "phase-0" });
  });
});
