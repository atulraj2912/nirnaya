"use client";

import { useRouter } from "next/navigation";

const typeIcons = {
  TICKET_CREATED: "bg-primary-100 text-primary-600",
  TICKET_ASSIGNED: "bg-success-100 text-success-600",
  TICKET_REASSIGNED: "bg-success-100 text-success-600",
  TICKET_STATUS_CHANGED: "bg-warning-100 text-warning-600",
  TICKET_PRIORITY_CHANGED: "bg-warning-100 text-warning-600",
  COMMENT_ADDED: "bg-primary-100 text-primary-600",
  WATCHER_ADDED: "bg-surface-secondary text-text-secondary",
  WATCHER_REMOVED: "bg-surface-secondary text-text-secondary",
  SLA_WARNING: "bg-warning-100 text-warning-600",
  SLA_BREACHED: "bg-danger-100 text-danger-600",
  ASSIGNMENT_ACCEPTED: "bg-success-100 text-success-600",
};

const typeShortLabels = {
  TICKET_CREATED: "New",
  TICKET_ASSIGNED: "Assigned",
  TICKET_REASSIGNED: "Reassigned",
  TICKET_STATUS_CHANGED: "Status",
  TICKET_PRIORITY_CHANGED: "Priority",
  COMMENT_ADDED: "Comment",
  WATCHER_ADDED: "Watcher",
  WATCHER_REMOVED: "Watcher",
  SLA_WARNING: "SLA",
  SLA_BREACHED: "SLA",
  ASSIGNMENT_ACCEPTED: "Accepted",
};

function timeAgo(date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) {
  const router = useRouter();

  function handleNotificationClick(notif) {
    if (!notif.isRead) {
      onMarkRead(notif.id);
    }
    if (notif.ticketId) {
      router.push(`/tickets/${notif.ticketId}`);
      onClose();
    }
  }

  return (
    <div className="max-h-96 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text">Notifications</h3>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-80">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-text-muted">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <svg
              className="mb-2 h-8 w-8 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-secondary ${
                  !notif.isRead ? "bg-primary-50/30" : ""
                }`}
              >
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    typeIcons[notif.type] || "bg-surface-secondary text-text-secondary"
                  }`}
                >
                  {typeShortLabels[notif.type] || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      notif.isRead ? "text-text-secondary" : "text-text font-medium"
                    }`}
                  >
                    {notif.message}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-text-muted">
                      {timeAgo(notif.createdAt)}
                    </span>
                    {notif.ticket && (
                      <span className="text-xs text-text-muted">
                        {notif.ticket.ticketNumber}
                      </span>
                    )}
                  </div>
                </div>
                {!notif.isRead && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
