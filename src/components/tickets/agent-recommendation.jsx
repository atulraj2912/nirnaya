"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/button";

/**
 * Agent Recommendation panel for ticket detail.
 * Shows ranked agent recommendations with scoring breakdown.
 * Per spec §18: "Recommendation is NOT the same thing as assignment."
 *
 * Role-gated: only AGENT/ADMIN see the panel.
 */

function ScoreBar({ score }) {
  const width = Math.min(100, Math.max(0, score));
  let color = "bg-success-500";
  if (score < 40) color = "bg-danger-500";
  else if (score < 70) color = "bg-warning-500";

  return (
    <div className="w-full bg-surface-secondary rounded-full h-2">
      <div className={`${color} h-2 rounded-full`} style={{ width: `${width}%` }} />
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  let variant = "bg-success-100 text-success-800";
  if (pct < 60) variant = "bg-danger-100 text-danger-800";
  else if (pct < 75) variant = "bg-warning-100 text-warning-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variant}`}>
      {pct}% confidence
    </span>
  );
}

export default function AgentRecommendation({ ticketId, userRole }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/recommendations`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        const result = await res.json();
        setError(result.error || "Failed to load recommendations");
      }
    } catch {
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (userRole !== "AGENT" && userRole !== "ADMIN") return;
      try {
        const res = await fetch(`/api/tickets/${ticketId}/recommendations`);
        if (res.ok && !cancelled) {
          const result = await res.json();
          setData(result);
        } else if (!cancelled) {
          const result = await res.json();
          setError(result.error || "Failed to load recommendations");
        }
      } catch {
        if (!cancelled) setError("Failed to load recommendations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [ticketId, userRole]);

  const canRecommend = userRole === "AGENT" || userRole === "ADMIN";

  if (!canRecommend) return null;

  const recommendations = data?.recommendations || [];
  const totalEligible = data?.totalEligibleAgents || 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">AI Agent Recommendations</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          {refreshing ? "Recalculating..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700 mb-4">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading recommendations...</p>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-text-muted">
            {totalEligible === 0
              ? "No eligible agents found in this department."
              : "No recommendations available."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            {totalEligible} eligible agent{totalEligible !== 1 ? "s" : ""} in your organization.
            Top recommendations shown below.
          </p>

          {recommendations.slice(0, 2).map((rec) => (
            <div
              key={rec.agentId}
              className={`rounded-lg border p-4 ${
                rec.rank === 1
                  ? "border-primary-200 bg-primary-50/30"
                  : "border-border bg-surface-secondary"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text text-sm">
                      {rec.username}
                    </span>
                    {rec.rank === 1 && (
                      <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-800">
                        TOP PICK
                      </span>
                    )}
                    <ConfidenceBadge confidence={rec.confidence} />
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {rec.department || "No department"} · Score: {rec.score.toFixed(1)}
                  </p>
                </div>
                <span className="text-xs text-text-muted">#{rec.rank}</span>
              </div>

              <ScoreBar score={rec.score} />

              <p className="text-xs text-text mt-2 mb-2">{rec.explanation}</p>

              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>
                  Active tickets: {rec.workload.activeTickets}
                  {rec.workload.highPriorityTickets > 0 && (
                    <span className="text-warning-600 ml-1">
                      ({rec.workload.highPriorityTickets} high)
                    </span>
                  )}
                </div>
                <div>
                  Resolved: {rec.experience.totalResolved}
                  {rec.experience.categoryResolved > 0 && (
                    <span className="ml-1">
                      ({rec.experience.categoryResolved} in category)
                    </span>
                  )}
                </div>
              </div>

              {rec.rank === 1 && rec.factors && (
                <details className="mt-2">
                  <summary className="text-xs text-text-muted cursor-pointer hover:text-text">
                    Scoring breakdown
                  </summary>
                  <div className="mt-2 space-y-1">
                    {rec.factors.map((f) => (
                      <div key={f.name} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">
                          {f.name} ({Math.round(f.weight * 100)}%)
                        </span>
                        <span className="text-text">
                          {f.contribution.toFixed(1)} / {(f.weight * 100).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          {recommendations.length > 2 && (
            <p className="text-xs text-text-muted text-center">
              {recommendations.length - 2} more recommendation{recommendations.length - 2 !== 1 ? "s" : ""} available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
