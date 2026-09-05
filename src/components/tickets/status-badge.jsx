const statusColors = {
  OPEN: "neutral",
  ASSIGNED: "primary",
  IN_PROGRESS: "warning",
  WAITING_FOR_USER: "danger",
  RESOLVED: "success",
  CLOSED: "neutral",
  REOPENED: "warning",
};

const priorityColors = {
  LOW: "neutral",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function StatusBadge({ status }) {
  const color = statusColors[status] || "neutral";
  const label = status?.replace(/_/g, " ") || "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-${color}-100 text-${color}-800`}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const color = priorityColors[priority] || "neutral";
  const label = priority || "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-${color}-100 text-${color}-800`}
    >
      {label}
    </span>
  );
}
