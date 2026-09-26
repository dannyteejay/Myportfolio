import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { HttpError } from "./utils.js";

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as any,
  });
}

export function newRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = newRefreshTokenValue();
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });
  if (!existing) throw new HttpError(401, "Invalid refresh token");
  if (existing.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: existing.id } });
    throw new HttpError(401, "Refresh token expired");
  }
  await prisma.refreshToken.delete({ where: { id: existing.id } });
  const newToken = await issueRefreshToken(existing.userId);
  return { user: existing.user, refreshToken: newToken };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}
