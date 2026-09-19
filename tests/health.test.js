import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Toolchain smoke test", () => {
  it("health route handler returns an ok status with version", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", version: "V1" });
  });
});
