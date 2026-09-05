"use client";

import { useState, useEffect } from "react";

export default function CommentList({ ticketId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        } else {
          setError("Failed to load comments");
        }
      } catch {
        setError("Failed to load comments");
      }
      setLoading(false);
    }
    fetchComments();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">Comments</h2>
        <p className="text-sm text-text-muted">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold text-text">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-text-muted">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="border-l-2 border-border pl-4">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="font-medium text-text">
                  {c.author?.username}
                </span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                {c.visibility === "INTERNAL" && (
                  <span className="rounded bg-warning-100 px-1.5 py-0.5 text-warning-800">
                    Internal
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
