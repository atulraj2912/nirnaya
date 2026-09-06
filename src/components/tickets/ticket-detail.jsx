"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge, PriorityBadge } from "./status-badge";
import Button from "@/components/ui/button";
import AIClassification from "./ai-classification";
import AgentRecommendation from "./agent-recommendation";
import SLAInfo from "./sla-info";
import CommentList from "@/components/comments/comment-list";
import CommentForm from "@/components/comments/comment-form";
import WatcherToggle from "@/components/watchers/watcher-toggle";
import ActivityTimeline from "@/components/activity/activity-timeline";

const ALLOWED_TRANSITIONS = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_FOR_USER", "RESOLVED"],
  WAITING_FOR_USER: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS"],
  CLOSED: [],
};

const STATUS_LABELS = {
  ASSIGNED: "Assign",
  IN_PROGRESS: "Start Progress",
  WAITING_FOR_USER: "Wait for User",
  RESOLVED: "Resolve",
  CLOSED: "Close",
  REOPENED: "Reopen",
};

export default function TicketDetail({ ticketId }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [commentsKey, setCommentsKey] = useState(0);

  useEffect(() => {
    async function fetchTicket() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        if (res.ok) {
          const data = await res.json();
          setTicket(data.ticket);
        } else {
          setError("Ticket not found");
        }
      } catch {
        setError("Network error. Please check your connection.");
      }
      setLoading(false);
    }
    fetchTicket();
  }, [ticketId]);

  useEffect(() => {
    async function fetchAgents() {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    }
    if (currentUser?.role === "AGENT" || currentUser?.role === "ADMIN") {
      fetchAgents();
    }
  }, [currentUser?.role]);

  useEffect(() => {
    async function fetchCurrentUser() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    }
    fetchCurrentUser();
  }, []);

  async function handleStatusChange(newStatus) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update status");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssign() {
    if (!assignAgentId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: assignAgentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
        setAssignAgentId("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to assign ticket");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12 text-text-muted">Loading ticket...</div>;
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <p className="text-sm">{error || "Ticket not found"}</p>
        <button
          onClick={() => {
            setError("");
            setLoading(true);
            fetch(`/api/tickets/${ticketId}`).then((res) => {
              if (res.ok) res.json().then((d) => setTicket(d.ticket));
              else setError("Ticket not found");
              setLoading(false);
            }).catch(() => { setError("Network error"); setLoading(false); });
          }}
          className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const transitions = ALLOWED_TRANSITIONS[ticket.status] || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-text-muted">{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-xl font-semibold text-text">{ticket.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/tickets")}>
            ← Back
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-text-muted">Type</span>
            <p className="font-medium text-text">{ticket.type}</p>
          </div>
          <div>
            <span className="text-text-muted">Department</span>
            <p className="font-medium text-text">{ticket.department?.name || "—"}</p>
          </div>
          <div>
            <span className="text-text-muted">Category</span>
            <p className="font-medium text-text">{ticket.category?.name || "—"}</p>
          </div>
          <div>
            <span className="text-text-muted">Requester</span>
            <p className="font-medium text-text">{ticket.requester?.username || "—"}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-text-muted mb-2">Description</h3>
          <p className="whitespace-pre-wrap text-sm text-text">{ticket.description}</p>
        </div>

        {ticket.ticketTags?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ticket.ticketTags.map((tt) => (
              <span
                key={tt.tag.id}
                className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs text-text-secondary"
              >
                {tt.tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">Actions</h2>

        <div className="flex flex-wrap gap-3">
          {transitions.map((status) => (
            <Button
              key={status}
              variant={status === "RESOLVED" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleStatusChange(status)}
              disabled={actionLoading}
            >
              {STATUS_LABELS[status] || status}
            </Button>
          ))}
        </div>

        {(currentUser?.role === "AGENT" || currentUser?.role === "ADMIN") && (
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-text">Assign to Agent</label>
              <select
                value={assignAgentId}
                onChange={(e) => setAssignAgentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username} ({a.role})
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!assignAgentId || actionLoading}
            >
              Assign
            </Button>
          </div>
        )}
      </div>

      <SLAInfo ticketId={ticketId} />

      <AIClassification ticketId={ticketId} userRole={currentUser?.role} />

      <AgentRecommendation ticketId={ticketId} userRole={currentUser?.role} />

      {ticket.assignmentHistory?.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold text-text">Assignment History</h2>
          <div className="space-y-3">
            {ticket.assignmentHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <span className="text-text-muted">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
                <span className="text-text">
                  {h.assignedBy?.username} → {h.assignedTo?.username}
                </span>
                {h.reason && <span className="text-text-muted">({h.reason})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <WatcherToggle ticketId={ticketId} currentUser={currentUser} />

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">Add Comment</h2>
        <CommentForm
          ticketId={ticketId}
          userRole={currentUser?.role}
          onCommentAdded={() => setCommentsKey((k) => k + 1)}
        />
      </div>

      <CommentList key={commentsKey} ticketId={ticketId} />

      <ActivityTimeline ticketId={ticketId} />
    </div>
  );
}
