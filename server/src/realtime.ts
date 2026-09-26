import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { env } from "./env.js";

let io: SocketIOServer | null = null;

export function initRealtime(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    path: "/socket.io",
  });
  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true });
  });
  return io;
}

// Broadcast a change event so connected clients (public site + admin) refetch.
export function emit(event: string, payload: unknown) {
  if (io) io.emit(event, payload);
}
