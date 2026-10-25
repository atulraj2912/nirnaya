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

// Capture the socket instance when subscribing. During logout, disconnectSocket()
// sets the module-level socket to null before React effects necessarily clean up.
// Cleanup must use the captured instance rather than dereferencing that mutable
// module-level variable.
function subscribeToEvent(eventName, callback) {
  const activeSocket = socket;
  if (!activeSocket) return () => {};

  activeSocket.on(eventName, callback);
  let subscribed = true;

  return () => {
    if (!subscribed) return;
    subscribed = false;
    activeSocket.off(eventName, callback);
  };
}

export function onNotification(callback) {
  return subscribeToEvent("notification:new", callback);
}

export function onNotificationRead(callback) {
  return subscribeToEvent("notification:read", callback);
}

export function onNotificationReadAll(callback) {
  return subscribeToEvent("notification:read_all", callback);
}

export function onTicketUpdated(callback) {
  return subscribeToEvent("ticket:updated", callback);
}

export function onTicketStatusChanged(callback) {
  return subscribeToEvent("ticket:status-changed", callback);
}

export function onTicketAssigned(callback) {
  return subscribeToEvent("ticket:assigned", callback);
}

export function onTicketCommentAdded(callback) {
  return subscribeToEvent("ticket:comment_added", callback);
}
