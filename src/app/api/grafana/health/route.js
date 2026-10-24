import { NextResponse } from "next/server";
import { extractGrafanaToken, validateGrafanaToken } from "@/lib/validation/grafana";

/**
 * GET /api/grafana/health
 *
 * Health check endpoint for Grafana datasource verification.
 * Validates the service token and returns connectivity status.
 *
 * This endpoint is lightweight and does not query the database.
 * It verifies:
 *   1. Authorization header is present and valid
 *   2. Service token matches a configured token
 *   3. Required environment variables are set
 *
 * Used by Grafana datasource health checks and the infrastructure
 * test dashboard.
 *
 * Auth: Bearer service token (GRAFANA_SERVICE_TOKEN or GRAFANA_AGENT_SERVICE_TOKEN)
 */
export async function GET(request) {
  const { valid, token, error } = extractGrafanaToken(request);
  if (!valid) {
    return NextResponse.json(
      {
        status: "error",
        datasource: { status: "error", message: error },
        authorization: { status: "error", message: error },
      },
      { status: 401 }
    );
  }

  const validation = await validateGrafanaToken(token);
  if (!validation.valid) {
    return NextResponse.json(
      {
        status: "error",
        datasource: { status: "ok", message: "NIRNAYA reachable" },
        authorization: { status: "error", message: validation.error },
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    status: "ok",
    version: "0.1.0",
    datasource: {
      status: "ok",
      message: "NIRNAYA reachable",
    },
    authorization: {
      status: "ok",
      message: `Authenticated as ${validation.type} scope`,
      type: validation.type,
    },
  });
}
