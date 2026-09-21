"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import NotificationList from "./notification-list";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notification-queries";
import { onNotification, onNotificationReadAll } from "@/lib/realtime/socket-client";

export default function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;

  const {
    data: notificationsData,
    isLoading,
    error: queryError,
    refetch: refetchNotifications,
  } = useNotifications({ limit: 10 }, { enabled: isOpen });

  const notifications = notificationsData?.notifications ?? [];
  const error = queryError ? "Failed to load notifications" : "";

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Realtime: invalidate caches on new notification
  const handleNewNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [queryClient, isOpen]);

  const handleReadAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [queryClient, isOpen]);

  useEffect(() => {
    const cleanupNew = onNotification(handleNewNotification);
    const cleanupReadAll = onNotificationReadAll(handleReadAll);
    return () => {
      cleanupNew();
      cleanupReadAll();
    };
  }, [handleNewNotification, handleReadAll]);

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      refetchNotifications();
    }
  }

  function handleMarkRead(notificationId) {
    markReadMutation.mutate(notificationId);
  }

  function handleMarkAllRead() {
    markAllReadMutation.mutate();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-text transition-colors"
        aria-label="Notifications"
        onClick={handleToggle}
      >
        <svg
          className="h-5 w-5"
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
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl">
          <NotificationList
            notifications={notifications}
            loading={isLoading}
            error={error}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onClose={() => setIsOpen(false)}
            onRetry={refetchNotifications}
          />
        </div>
      )}
    </div>
  );
}
