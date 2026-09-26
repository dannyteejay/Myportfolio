import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import path from "node:path";
import { z } from "zod";
import { env } from "./env.js";
import { HttpError } from "./utils.js";
import { initRealtime } from "./realtime.js";

import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import productRoutes from "./routes/products.js";
import skillRoutes from "./routes/skills.js";
import profileRoutes from "./routes/profile.js";
import messageRoutes from "./routes/messages.js";
import uploadRoutes from "./routes/uploads.js";
import paymentRoutes from "./routes/payments.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN.split(","),
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      // Preserve the raw body so webhook signatures can be verified.
      (req as any).rawBody = buf;
    },
  })
);
app.use(cookieParser());

// Serve uploaded files
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"), {
    maxAge: "7d",
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/products", productRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/payments", paymentRoutes);

// API 404 (must stay above the SPA fallback)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: { message: "Not found" } });
});

// ---- Serve the built frontend in production ----
// The React app is a static build; the backend serves it so the API,
// WebSocket and site all share one origin (no CORS / cookie issues).
if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(
    process.cwd(),
    process.env.CLIENT_DIST ?? "../client/dist"
  );
  app.use(express.static(clientDist));
  // SPA fallback: any non-API, non-file route returns index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { message: "Validation failed", issues: err.issues },
      });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { message: err.message } });
    }
    console.error(err);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
);

const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${env.PORT}`);
});
