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
