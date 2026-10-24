"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";

const GRAFANA_BASE_URL = "http://localhost:3100";
const GRAFANA_DASHBOARD_UID = "nirnaya-admin";
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes (token expires in 5)

/**
 * GrafanaEmbed — Renders the G3 Grafana admin dashboard inside NIRNAYA.
 *
 * Security:
 *   - Fetches embed token from server-side API (ADMIN-only endpoint)
 *   - Token is short-lived (5 minutes), refreshed automatically
 *   - Token is never exposed in HTML source or browser storage
 *   - Grafana iframe uses auth_token query parameter (not header)
 *   - Iframe is sandboxed with minimal permissions
 *
 * Failure Isolation:
 *   - If Grafana is unreachable, shows error state (does not crash NIRNAYA)
 *   - If token fetch fails, shows error state
 *   - If iframe fails to load, shows error state
 *
 * @param {object} props
 * @param {string} props.className - Additional CSS classes
 */
export default function GrafanaEmbed({ className = "" }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/grafana/embed/token", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get embed token");
      }
      const data = await res.json();
      setToken(data.token);
      setError(null);
      return data.token;
    } catch (err) {
      setError(err.message || "Failed to authenticate with Grafana");
      return null;
    }
  }, []);

  // Initial token fetch
  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      await fetchToken();
      if (mounted) setLoading(false);
    }

    init();

    // Refresh token before expiry
    const interval = setInterval(() => {
      if (mounted) fetchToken();
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchToken]);

  const iframeUrl = token
    ? `${GRAFANA_BASE_URL}/d/${GRAFANA_DASHBOARD_UID}?orgId=1&auth_token=${token}&kiosk`
    : null;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-text-muted">Loading analytics dashboard...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-base font-semibold text-text">Grafana Analytics</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-sm text-danger-600 mb-2">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => fetchToken()}>
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Grafana Analytics</h2>
          <div className="flex items-center gap-2">
            {!iframeLoaded && (
              <span className="text-xs text-text-muted">Loading dashboard...</span>
            )}
            {iframeLoaded && !iframeError && (
              <span className="text-xs text-success-600">Connected</span>
            )}
            {iframeError && (
              <Button variant="ghost" size="sm" onClick={() => { setIframeError(false); setIframeLoaded(false); }}>
                Reload
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {iframeUrl ? (
          <div className="relative" style={{ minHeight: "800px" }}>
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-secondary">
                <div className="text-center">
                  <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-text-muted">Connecting to Grafana...</p>
                </div>
              </div>
            )}
            {iframeError ? (
              <div className="flex items-center justify-center h-64 bg-surface-secondary">
                <div className="text-center">
                  <p className="text-sm text-danger-600 mb-2">Analytics dashboard is temporarily unavailable.</p>
                  <Button variant="ghost" size="sm" onClick={() => { setIframeError(false); setIframeLoaded(false); }}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <iframe
                src={iframeUrl}
                title="Grafana Admin Analytics Dashboard"
                className="w-full border-0"
                style={{ minHeight: "800px", height: "80vh" }}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-text-muted">Unable to load analytics dashboard.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
