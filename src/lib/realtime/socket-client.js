"use client";

import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (typeof window === "undefined") return null;
  return socket;
}

export function connectSocket(token) {
  if (typeof window === "undefined") return null;

  if (socket && socket.connected) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io({
    path: "/api/socketio",
    auth: token ? { token } : {},
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Socket] Connected");
    }
  });

  socket.on("disconnect", (reason) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Socket] Disconnected:", reason);
    }
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToTicket(ticketId) {
  if (socket && socket.connected) {
    socket.emit("ticket:subscribe", ticketId);
  }
}

export function unsubscribeFromTicket(ticketId) {
  if (socket && socket.connected) {
    socket.emit("ticket:unsubscribe", ticketId);
  }
}

export function onNotification(callback) {
  if (!socket) return () => {};
  socket.on("notification:new", callback);
  return () => socket.off("notification:new", callback);
}

export function onNotificationRead(callback) {
  if (!socket) return () => {};
  socket.on("notification:read", callback);
  return () => socket.off("notification:read", callback);
}

export function onNotificationReadAll(callback) {
  if (!socket) return () => {};
  socket.on("notification:read_all", callback);
  return () => socket.off("notification:read_all", callback);
}

export function onTicketUpdated(callback) {
  if (!socket) return () => {};
  socket.on("ticket:updated", callback);
  return () => socket.off("ticket:updated", callback);
}

export function onTicketStatusChanged(callback) {
  if (!socket) return () => {};
  socket.on("ticket:status-changed", callback);
  return () => socket.off("ticket:status-changed", callback);
}

export function onTicketAssigned(callback) {
  if (!socket) return () => {};
  socket.on("ticket:assigned", callback);
  return () => socket.off("ticket:assigned", callback);
}

export function onTicketCommentAdded(callback) {
  if (!socket) return () => {};
  socket.on("ticket:comment_added", callback);
  return () => socket.off("ticket:comment_added", callback);
}
