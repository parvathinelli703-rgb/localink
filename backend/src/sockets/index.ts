import { Server, Socket } from "socket.io";
import { verifyToken } from "../utils/auth";

interface AuthenticatedSocket extends Socket {
  userId?: number;
  role?: string;
}

let ioInstance: Server | null = null;

export function setupSockets(io: Server) {
  ioInstance = io;

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      socket.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: user ${socket.userId} (${socket.role})`);

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on("booking:join", (bookingId: number) => {
      socket.join(`booking:${bookingId}`);
      socket.emit("booking:joined", { bookingId });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user ${socket.userId}`);
    });
  });
}

// ============ Emit helpers ============
export function emitToUser(userId: number, event: string, data: any) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToBooking(bookingId: number, event: string, data: any) {
  if (ioInstance) {
    ioInstance.to(`booking:${bookingId}`).emit(event, data);
  }
}

export function emitToAllProviders(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}