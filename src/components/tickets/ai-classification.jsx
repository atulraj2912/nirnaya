"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/button";

/**
 * AI Classification panel for ticket detail.
 * Shows existing predictions and allows triggering new classification.
 */

const PRIORITY_COLORS = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-warning-100 text-warning-800",
  CRITICAL: "bg-danger-100 text-danger-800",
};

export default function AIClassification({ ticketId, userRole }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/tickets/${ticketId}/ai`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPredictions(data.predictions || []);
        }
      } catch {
        // Silently fail — predictions are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ticketId]);

  async function handleClassify() {
    setClassifying(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/classify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prediction) {
          setPredictions((prev) => [data.prediction, ...prev]);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Classification failed");
      }
    } catch {
      setError("Classification request failed");
    } finally {
      setClassifying(false);
    }
  }

  const latest = predictions[0];
  const canClassify = userRole === "AGENT" || userRole === "ADMIN";

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">AI Classification</h2>
        {canClassify && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleClassify}
            disabled={classifying}
          >
            {classifying ? "Classifying..." : "Run Classification"}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700 mb-4">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading predictions...</p>
      ) : latest ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-text-muted">Category</span>
              <p className="font-medium text-text">
                {latest.predictedCategory?.name || latest.categoryName || "—"}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Priority</span>
              <p className="font-medium text-text">
                {latest.predictedPriority ? (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[latest.predictedPriority] || ""}`}>
                    {latest.predictedPriority}
                  </span>
                ) : "—"}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Department</span>
              <p className="font-medium text-text">
                {latest.predictedDepartment?.name || "—"}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Confidence</span>
              <p className="font-medium text-text">
                {latest.confidence != null ? `${Math.round(latest.confidence * 100)}%` : "—"}
              </p>
            </div>
          </div>

          {latest.explanation && (
            <div>
              <span className="text-xs text-text-muted">Explanation</span>
              <p className="mt-1 text-sm text-text">{latest.explanation}</p>
            </div>
          )}

          {latest.suggestedNextSteps && (
            <div>
              <span className="text-xs text-text-muted">Suggested Next Steps</span>
              <p className="mt-1 text-sm text-text">{latest.suggestedNextSteps}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Provider: {latest.provider || "unknown"}</span>
            {latest.createdAt && (
              <>
                <span>·</span>
                <span>{new Date(latest.createdAt).toLocaleString()}</span>
              </>
            )}
          </div>

          {predictions.length > 1 && (
            <details className="text-xs text-text-muted">
              <summary className="cursor-pointer hover:text-text">
                {predictions.length - 1} earlier prediction(s)
              </summary>
              <div className="mt-2 space-y-2 pl-4 border-l-2 border-border">
                {predictions.slice(1).map((p) => (
                  <div key={p.id} className="text-xs">
                    <span>{new Date(p.createdAt).toLocaleString()}</span>
                    <span className="ml-2">{p.predictedCategory?.name || p.categoryName || "—"}</span>
                    <span className="ml-2">{p.predictedPriority || "—"}</span>
                    <span className="ml-2">{p.confidence != null ? `${Math.round(p.confidence * 100)}%` : "—"}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-text-muted">
            No AI predictions yet.
            {canClassify && " Click \"Run Classification\" to analyze this ticket."}
          </p>
        </div>
      )}
    </div>
  );
}
