import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { env } from "./env.js";
import { HttpError } from "./utils.js";
import { initRealtime } from "./realtime.js";
import { prisma } from "./prisma.js";

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
// For HTML requests we inject the profile's title/description meta tags so
// link previews (WhatsApp, etc.) and search engines reflect admin changes.
if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(
    process.cwd(),
    process.env.CLIENT_DIST ?? "../client/dist"
  );

  // Load the built index.html once, and strip any static title/description/
  // og/twitter tags so we can inject fresh ones from the database per request.
  const rawIndex = fs.readFileSync(path.join(clientDist, "index.html"), "utf8");
  const indexTemplate = rawIndex
    .replace(/\s*<meta\s+property=["']og:[^>]*>/gi, "")
    .replace(/\s*<meta\s+name=["']twitter:[^>]*>/gi, "")
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/gi, "");

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  async function renderIndex(reqUrl: string, host: string): Promise<string> {
    let title = "Portfolio";
    let description = "";
    let image = "";
    try {
      const p = await prisma.profile.findUnique({ where: { id: "singleton" } });
      if (p) {
        title = (p.metaTitle && p.metaTitle.trim()) || `${p.name} — ${p.title}`;
        description =
          (p.metaDescription && p.metaDescription.trim()) || p.tagline || "";
        image = p.avatar || "";
      }
    } catch {
      /* fall back to defaults if the DB is unavailable */
    }

    const url = `https://${host}${reqUrl}`;
    const tags = [
      `<meta name="description" content="${esc(description)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      image ? `<meta property="og:image" content="${esc(image)}" />` : "",
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(description)}" />`,
      image ? `<meta name="twitter:image" content="${esc(image)}" />` : "",
    ]
      .filter(Boolean)
      .join("\n    ");

    return indexTemplate
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
      .replace("</head>", `    ${tags}\n  </head>`);
  }

  // Serve static assets but NOT index.html (so all HTML goes through injection).
  app.use(express.static(clientDist, { index: false }));

  // SPA fallback: any non-API route returns index.html with injected meta tags.
  app.get("*", async (req, res, next) => {
    try {
      const html = await renderIndex(req.originalUrl, req.get("host") ?? "");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e) {
      next(e);
    }
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