const statusColorClasses = {
  OPEN: "bg-gray-50 text-gray-700 ring-gray-600/10",
  ASSIGNED: "bg-primary-50 text-primary-700 ring-primary-600/10",
  IN_PROGRESS: "bg-warning-50 text-warning-700 ring-warning-600/10",
  WAITING_FOR_USER: "bg-danger-50 text-danger-700 ring-danger-600/10",
  RESOLVED: "bg-success-50 text-success-700 ring-success-600/10",
  CLOSED: "bg-gray-50 text-gray-700 ring-gray-600/10",
  REOPENED: "bg-warning-50 text-warning-700 ring-warning-600/10",
};

const priorityColorClasses = {
  LOW: "bg-gray-50 text-gray-700 ring-gray-600/10",
  MEDIUM: "bg-primary-50 text-primary-700 ring-primary-600/10",
  HIGH: "bg-warning-50 text-warning-700 ring-warning-600/10",
  CRITICAL: "bg-danger-50 text-danger-700 ring-danger-600/10",
};

export function StatusBadge({ status }) {
  const colorClasses = statusColorClasses[status] || "bg-gray-50 text-gray-700 ring-gray-600/10";
  const label = status?.replace(/_/g, " ") || "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorClasses}`}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const colorClasses = priorityColorClasses[priority] || "bg-gray-50 text-gray-700 ring-gray-600/10";
  const label = priority || "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorClasses}`}
    >
      {label}
    </span>
  );
}
