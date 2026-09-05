import { verifyAccessToken } from "@/lib/auth/jwt.js";
import prisma from "@/lib/db/prisma.js";

const ACCESS_TOKEN_NAME = "nirnaya_access_token";

function extractToken(socket) {
  const auth = socket.handshake.auth;
  if (auth && auth.token) return auth.token;

  const headers = socket.handshake.headers;
  if (headers && headers.cookie) {
    const match = headers.cookie.match(
      new RegExp(`${ACCESS_TOKEN_NAME}=([^;]+)`)
    );
    if (match) return match[1];
  }

  const query = socket.handshake.query;
  if (query && query.token) return query.token;

  return null;
}

async function authenticateSocket(socket) {
  const token = extractToken(socket);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      organizationId: true,
      departmentId: true,
    },
  });

  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

export function setupSocketServer(io) {
  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket);
      if (!user) {
        return next(new Error("Authentication required"));
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.join(`user:${user.id}`);
    socket.join(`org:${user.organizationId}`);

    socket.on("ticket:subscribe", async (ticketId) => {
      try {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: {
            id: true,
            organizationId: true,
            requesterId: true,
            assignedAgentId: true,
          },
        });

        if (!ticket || ticket.organizationId !== user.organizationId) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        if (
          user.role === "USER" &&
          ticket.requesterId !== user.id
        ) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        socket.join(`ticket:${ticketId}`);
        socket.emit("ticket:subscribed", { ticketId });
      } catch {
        socket.emit("error", { message: "Failed to subscribe" });
      }
    });

    socket.on("ticket:unsubscribe", (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on("disconnect", () => {});
  });
}

export function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToOrg(io, organizationId, event, data) {
  io.to(`org:${organizationId}`).emit(event, data);
}

export function emitToTicket(io, ticketId, event, data) {
  io.to(`ticket:${ticketId}`).emit(event, data);
}
