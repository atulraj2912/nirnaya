"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";
import NotificationBell from "@/components/notifications/notification-bell";
import { useSocketStatus, useSocketConnection } from "@/hooks/use-realtime";

function getInitials(user) {
  if (!user) return "U";
  const first = user.username?.charAt(0) || "";
  const last = user.username?.split(".").pop()?.charAt(0) || "";
  return (first + last).toUpperCase();
}

function getRoleBadgeClass(role) {
  switch (role) {
    case "ADMIN":
      return "bg-danger-50 text-danger-700 ring-danger-600/10";
    case "AGENT":
      return "bg-primary-50 text-primary-700 ring-primary-600/10";
    default:
      return "bg-surface-secondary text-text-secondary ring-gray-500/10";
  }
}

const statusColors = {
  connected: "bg-success-500",
  disconnected: "bg-danger-500",
  reconnecting: "bg-warning-500",
};

const statusLabels = {
  connected: "Connected",
  disconnected: "Offline",
  reconnecting: "Reconnecting...",
};

export default function Header({ user }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  useSocketConnection();
  const socketStatus = useSocketStatus();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      // Logout failed silently — user can retry
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="inline-flex h-14 items-center bg-surface/80 backdrop-blur-sm px-4 gap-2 w-fit">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-2 py-1" title={statusLabels[socketStatus]}>
          <span className={`h-2 w-2 rounded-full ${statusColors[socketStatus]}`} />
          <span className="text-xs text-text-muted hidden sm:inline">{statusLabels[socketStatus]}</span>
        </div>

        <NotificationBell user={user} />

        <div className="h-4 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 shrink-0">
            {getInitials(user)}
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="truncate text-sm font-medium text-text leading-tight max-w-[140px]">
              {user?.username || "User"}
            </p>
            <span className={`inline-block rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset leading-tight ${getRoleBadgeClass(user?.role)}`}>
              {user?.role || "USER"}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-xs"
        >
          {loggingOut ? "Signing out..." : "Sign Out"}
        </Button>
      </div>
    </header>
  );
}
