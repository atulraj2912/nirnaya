import { beforeEach, describe, expect, it, vi } from "vitest";

const { socketMock } = vi.hoisted(() => ({
  socketMock: {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketMock),
}));

import { connectSocket, disconnectSocket, onNotification } from "@/lib/realtime/socket-client";

describe("socket-client subscription cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketMock.connected = true;
    disconnectSocket();
    vi.clearAllMocks();
  });

  it("cleans up a subscription safely if the socket disconnects before React cleanup", () => {
    connectSocket("test-token");
    const callback = vi.fn();
    const cleanup = onNotification(callback);

    disconnectSocket();

    expect(() => cleanup()).not.toThrow();
    expect(socketMock.off).toHaveBeenCalledWith("notification:new", callback);
  });

  it("allows a cleanup function to be called more than once", () => {
    connectSocket("test-token");
    const callback = vi.fn();
    const cleanup = onNotification(callback);

    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
    expect(socketMock.off).toHaveBeenCalledTimes(1);
  });
});
