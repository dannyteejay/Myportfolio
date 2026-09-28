# ===============================================================
#  Admin password recovery + hide demo credentials
#  Run this from your repo root:
#    cd C:\Users\USER\Downloads\portfolio\portfolio
#    powershell -ExecutionPolicy Bypass -File .\apply-recovery.ps1
#  (or just paste the whole file into a PowerShell window)
# ===============================================================
$ErrorActionPreference = "Stop"
Write-Host "Applying password-recovery changes..." -ForegroundColor Cyan

Write-Host "-> server/src/mailer.ts"
@'
import nodemailer from "nodemailer";
import { env } from "./env.js";

// Email is optional: if SMTP creds aren't configured we log the link instead
// of sending, so local/dev still works and the app never crashes.
const enabled = Boolean(env.SMTP_USER && env.SMTP_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export function mailerEnabled() {
  return enabled;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!transporter) {
    console.warn(
      "[mailer] SMTP not configured. Password reset link (copy manually):",
      resetUrl
    );
    return;
  }

  await transporter.sendMail({
    from: `"Portfolio Admin" <${env.SMTP_USER}>`,
    to,
    subject: "Reset your admin password",
    text:
      `You requested a password reset for your portfolio admin account.\n\n` +
      `Open this link to set a new password (valid for 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html:
      `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">` +
      `<h2 style="color:#111">Reset your admin password</h2>` +
      `<p>You requested a password reset for your portfolio admin account.</p>` +
      `<p><a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set a new password</a></p>` +
      `<p style="color:#666;font-size:13px">This link is valid for 1 hour. If the button doesn't work, paste this URL into your browser:</p>` +
      `<p style="color:#666;font-size:13px;word-break:break-all">${resetUrl}</p>` +
      `<p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email.</p>` +
      `</div>`,
  });
}
'@ | Set-Content -Path server/src/mailer.ts -Encoding UTF8

Write-Host "-> server/src/routes/auth.ts"
@'
import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../prisma.js";
import {
  AuthedRequest,
  hashPassword,
  issueRefreshToken,
  requireAuth,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from "../auth.js";
import { HttpError, ok } from "../utils.js";
import { env } from "../env.js";
import { sendPasswordResetEmail } from "../mailer.js";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const router = Router();

const REFRESH_COOKIE = "refresh_token";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.password))) {
      throw new HttpError(401, "Invalid email or password");
    }
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await issueRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    ok(res, {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, "No refresh token");
    const { user, refreshToken } = await rotateRefreshToken(token);
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    ok(res, {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Request a password reset link. Always returns a generic success message so
// the endpoint can't be used to discover which emails have accounts.
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Invalidate any previous outstanding tokens for this user.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const raw = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.passwordResetToken.create({
        data: { tokenHash: hashToken(raw), userId: user.id, expiresAt },
      });
      const base = env.APP_URL.replace(/\/$/, "");
      const resetUrl = `${base}/admin/reset-password?token=${raw}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        console.error("[forgot-password] failed to send email:", mailErr);
      }
    }
    ok(res, {
      message:
        "If an account exists for that email, a reset link has been sent.",
    });
  } catch (e) {
    next(e);
  }
});

// Complete the reset using the token from the emailed link.
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = resetSchema.parse(req.body);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new HttpError(400, "This reset link is invalid or has expired.");
    }
    const hash = await hashPassword(password);
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hash },
    });
    // Burn all reset tokens and force re-login everywhere.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: record.userId } });
    ok(res, { message: "Password updated. You can now sign in." });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new HttpError(404, "User not found");
    ok(res, { user });
  } catch (e) {
    next(e);
  }
});

export default router;
'@ | Set-Content -Path server/src/routes/auth.ts -Encoding UTF8

Write-Host "-> server/src/env.ts"
@'
import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev_access_secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev_refresh_secret"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "7"),
  PORT: Number(process.env.PORT ?? "4000"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "*",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@portfolio.dev",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "Admin123!",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
};
'@ | Set-Content -Path server/src/env.ts -Encoding UTF8

Write-Host "-> server/prisma/schema.prisma"
@'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String         @id @default(cuid())
  email        String         @unique
  password     String
  name         String
  role         String         @default("ADMIN")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  refreshTokens RefreshToken[]
  passwordResetTokens PasswordResetToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Project {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  category    String   // "software" | "webdesign"
  summary     String
  description String
  coverImage  String?
  liveUrl     String?
  repoUrl     String?
  tags        String[] @default([])
  featured    Boolean  @default(false)
  published   Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Product {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String
  price       Int      // price in kobo (NGN minor units)
  currency    String   @default("NGN")
  coverImage  String?
  fileUrl     String?  // downloadable asset (for digital products)
  tags        String[] @default([])
  published   Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Skill {
  id        String   @id @default(cuid())
  name      String
  category  String   @default("general")
  level     Int      @default(80) // 0-100
  order     Int      @default(0)
  createdAt DateTime @default(now())
}

model Profile {
  id         String   @id @default("singleton")
  name       String
  title      String
  metaTitle  String?
  metaDescription String?
  tagline    String
  bio        String
  email      String
  location   String?
  avatar     String?
  githubUrl  String?
  linkedinUrl String?
  twitterUrl String?
  websiteUrl String?
  resumeUrl  String?
  updatedAt  DateTime @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  name      String
  email     String
  subject   String?
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Order {
  id           String   @id @default(cuid())
  reference    String   @unique
  productId    String?
  productTitle String
  email        String
  amount       Int // minor units (kobo/cents)
  currency     String   @default("NGN")
  gateway      String // paystack | flutterwave | crypto | bank
  status       String   @default("pending") // pending | paid | failed | cancelled
  providerRef  String? // gateway transaction id / invoice id
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PaymentSettings {
  id                 String  @id @default("singleton")
  paystackEnabled    Boolean @default(true)
  flutterwaveEnabled Boolean @default(true)
  cryptoEnabled      Boolean @default(true)
  bankEnabled        Boolean @default(true)
  bankName           String?
  bankAccountName    String?
  bankAccountNumber  String?
  bankInstructions   String?
  cryptoNote         String?
  updatedAt          DateTime @updatedAt
}
'@ | Set-Content -Path server/prisma/schema.prisma -Encoding UTF8

Write-Host "-> server/package.json"
@'
{
  "name": "portfolio-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "seed": "tsx prisma/seed.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "cloudinary": "^2.5.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.16",
    "prisma": "^5.22.0",
    "socket.io": "^4.8.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.2",
    "@types/nodemailer": "^6.4.17",
    "vitest": "^2.1.8"
  }
}
'@ | Set-Content -Path server/package.json -Encoding UTF8

Write-Host "-> client/src/pages/admin/Login.tsx"
@'
import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/admin";

  if (user) {
    navigate(from, { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast("Welcome back!");
      navigate(from, { replace: true });
    } catch (e: any) {
      toast(e.message ?? "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute inset-0 spark" />
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white shadow-glow">
            AM
          </span>
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-heading">
          Admin sign in
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Manage your portfolio content
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link
                to="/admin/forgot-password"
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <IconArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-ink-400 hover:text-heading"
        >
          ← Back to site
        </Link>
      </motion.div>
    </div>
  );
}
'@ | Set-Content -Path client/src/pages/admin/Login.tsx -Encoding UTF8

Write-Host "-> client/src/pages/admin/ForgotPassword.tsx"
@'
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (err: any) {
      toast(err.message ?? "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute inset-0 spark" />
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white shadow-glow">
            AM
          </span>
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-heading">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Enter your admin email and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl bg-line/5 p-4 text-center text-sm text-ink-300 ring-1 ring-line/10">
            If an account exists for that email, a reset link is on its way.
            <br />
            Check your inbox (and spam folder). The link is valid for 1 hour.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Sending…" : "Send reset link"}
              {!loading && <IconArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        <Link
          to="/admin/login"
          className="mt-6 block text-center text-sm text-ink-400 hover:text-heading"
        >
          ← Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
'@ | Set-Content -Path client/src/pages/admin/ForgotPassword.tsx -Encoding UTF8

Write-Host "-> client/src/pages/admin/ResetPassword.tsx"
@'
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      toast("Password updated. Please sign in.");
      navigate("/admin/login", { replace: true });
    } catch (err: any) {
      toast(err.message ?? "Reset failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute inset-0 spark" />
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white shadow-glow">
            AM
          </span>
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-heading">
          Choose a new password
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Enter a new password for your admin account.
        </p>

        {!token ? (
          <div className="mt-8 rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-300 ring-1 ring-red-500/20">
            This reset link is missing its token. Please request a new link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Updating…" : "Update password"}
              {!loading && <IconArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        <Link
          to="/admin/login"
          className="mt-6 block text-center text-sm text-ink-400 hover:text-heading"
        >
          ← Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
'@ | Set-Content -Path client/src/pages/admin/ResetPassword.tsx -Encoding UTF8

Write-Host "-> client/src/App.tsx"
@'
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useRealtime } from "./hooks/useRealtime";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/queries";

import PublicLayout from "./components/PublicLayout";
import Home from "./pages/Home";
import Work from "./pages/Work";
import ProjectDetail from "./pages/ProjectDetail";
import Store from "./pages/Store";
import Contact from "./pages/Contact";
import PaymentCallback from "./pages/PaymentCallback";

import Login from "./pages/admin/Login";
import ForgotPassword from "./pages/admin/ForgotPassword";
import ResetPassword from "./pages/admin/ResetPassword";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminSkills from "./pages/admin/AdminSkills";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminPayments from "./pages/admin/AdminPayments";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}

function DocumentTitle() {
  const { data: profile } = useProfile();
  useEffect(() => {
    if (!profile) return;
    const base =
      profile.metaTitle?.trim() ||
      [profile.name, profile.title].filter(Boolean).join(" — ");
    if (base) document.title = base;
  }, [profile]);
  return null;
}

export default function App() {
  useRealtime();
  return (
    <>
      <DocumentTitle />
      <AnimatePresence mode="wait">
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/work/:slug" element={<ProjectDetail />} />
          <Route path="/store" element={<Store />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        <Route path="/payment/callback" element={<PaymentCallback />} />

        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="messages" element={<AdminMessages />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AnimatePresence>
    </>
  );
}
'@ | Set-Content -Path client/src/App.tsx -Encoding UTF8

# --- seed.ts: stop resetting the admin password on every deploy ---
Write-Host "-> server/prisma/seed.ts (patch upsert)"
$seedPath = "server/prisma/seed.ts"
$seed = Get-Content $seedPath -Raw
$seed = $seed.Replace('update: { password: hash },', 'update: {},')
Set-Content -Path $seedPath -Value $seed -Encoding UTF8

Write-Host ""
Write-Host "All files written successfully." -ForegroundColor Green
Write-Host "Next: git add -A ; git commit -m 'Add admin password recovery; hide demo creds' ; git push"
