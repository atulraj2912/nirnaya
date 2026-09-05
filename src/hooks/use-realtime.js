"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeToTicket,
  unsubscribeFromTicket,
  onNotification,
  onTicketUpdated,
  onTicketStatusChanged,
  onTicketAssigned,
  onTicketCommentAdded,
} from "@/lib/realtime/socket-client";

export function useSocketConnection(token) {
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    return () => {
      disconnectSocket();
    };
  }, [token]);
}

export function useSocketStatus() {
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function updateStatus() {
      setStatus(socket.connected ? "connected" : "disconnected");
    }

    updateStatus();

    socket.on("connect", updateStatus);
    socket.on("disconnect", updateStatus);
    socket.on("reconnect", updateStatus);
    socket.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.on("reconnect_error", () => setStatus("disconnected"));
    socket.on("reconnect_failed", () => setStatus("disconnected"));

    return () => {
      socket.off("connect", updateStatus);
      socket.off("disconnect", updateStatus);
      socket.off("reconnect", updateStatus);
      socket.off("reconnect_attempt");
      socket.off("reconnect_error");
      socket.off("reconnect_failed");
    };
  }, []);

  return status;
}

export function useTicketRealtime(ticketId, callbacks = {}) {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!ticketId) return;

    subscribeToTicket(ticketId);

    const cleanups = [];

    cleanups.push(
      onTicketUpdated((data) => {
        if (data.ticketId === ticketId && callbacksRef.current.onUpdated) {
          callbacksRef.current.onUpdated(data);
        }
      })
    );

    cleanups.push(
      onTicketStatusChanged((data) => {
        if (data.ticketId === ticketId && callbacksRef.current.onStatusChanged) {
          callbacksRef.current.onStatusChanged(data);
        }
      })
    );

    cleanups.push(
      onTicketAssigned((data) => {
        if (data.ticketId === ticketId && callbacksRef.current.onAssigned) {
          callbacksRef.current.onAssigned(data);
        }
      })
    );

    cleanups.push(
      onTicketCommentAdded((data) => {
        if (data.ticketId === ticketId && callbacksRef.current.onCommentAdded) {
          callbacksRef.current.onCommentAdded(data);
        }
      })
    );

    return () => {
      unsubscribeFromTicket(ticketId);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [ticketId]);
}

export function useNotificationRealtime(callbacks = {}) {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const cleanups = [];

    cleanups.push(
      onNotification((data) => {
        if (callbacksRef.current.onNew) {
          callbacksRef.current.onNew(data);
        }
      })
    );

    cleanups.push(
      onTicketUpdated((data) => {
        if (callbacksRef.current.onTicketUpdated) {
          callbacksRef.current.onTicketUpdated(data);
        }
      })
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);
}
