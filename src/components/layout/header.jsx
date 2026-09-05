"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";

function getInitials(user) {
  if (!user) return "U";
  const first = user.username?.charAt(0) || "";
  const last = user.username?.split(".").pop()?.charAt(0) || "";
  return (first + last).toUpperCase();
}

function getRoleBadgeClass(role) {
  switch (role) {
    case "ADMIN":
      return "bg-danger-100 text-danger-800";
    case "AGENT":
      return "bg-primary-100 text-primary-800";
    default:
      return "bg-surface-secondary text-text-secondary";
  }
}

export default function Header({ user }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-text-secondary">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-secondary"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-800">
            {getInitials(user)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">
              {user?.username || "User"}
            </p>
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getRoleBadgeClass(user?.role)}`}>
              {user?.role || "USER"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
