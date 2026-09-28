import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import {
  AuthedRequest,
  issueRefreshToken,
  requireAuth,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from "../auth.js";
import { HttpError, ok } from "../utils.js";
import { env } from "../env.js";

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
