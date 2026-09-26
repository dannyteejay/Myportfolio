import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { ok } from "../utils.js";
import { emit } from "../realtime.js";

const router = Router();

const schema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  metaTitle: z.string().nullable().optional(),
  tagline: z.string().min(1),
  bio: z.string().min(1),
  email: z.string().email(),
  location: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  twitterUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  resumeUrl: z.string().nullable().optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: "singleton" } });
    ok(res, profile);
  } catch (e) {
    next(e);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body);
    const profile = await prisma.profile.upsert({
      where: { id: "singleton" },
      update: data,
      create: {
        id: "singleton",
        name: data.name ?? "Your Name",
        title: data.title ?? "Developer",
        tagline: data.tagline ?? "",
        bio: data.bio ?? "",
        email: data.email ?? "you@example.com",
        ...data,
      },
    });
    emit("profile:changed", {});
    ok(res, profile);
  } catch (e) {
    next(e);
  }
});

export default router;