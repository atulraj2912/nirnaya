"use client";

import { useState } from "react";
import Button from "@/components/ui/button";

export default function CommentForm({ ticketId, userRole, onCommentAdded }) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canCreateInternal = userRole === "AGENT" || userRole === "ADMIN";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          visibility,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setContent("");
        setVisibility("PUBLIC");
        if (onCommentAdded) onCommentAdded(data.comment);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add comment");
      }
    } catch {
      setError("Failed to add comment");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        rows={3}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canCreateInternal && (
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={visibility === "INTERNAL"}
                onChange={(e) =>
                  setVisibility(e.target.checked ? "INTERNAL" : "PUBLIC")
                }
                className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
              />
              Internal
            </label>
          )}
        </div>

        <Button type="submit" size="sm" disabled={!content.trim() || loading}>
          {loading ? "Posting..." : "Add Comment"}
        </Button>
      </div>
    </form>
  );
}
