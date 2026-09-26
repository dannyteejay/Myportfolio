import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { HttpError, ok, uniqueSlug } from "../utils.js";
import { emit } from "../realtime.js";

const router = Router();

const upsertSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["software", "webdesign"]),
  summary: z.string().min(1),
  description: z.string().min(1),
  coverImage: z.string().nullable().optional(),
  liveUrl: z.string().nullable().optional(),
  repoUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  order: z.number().int().optional(),
});

// Public list
router.get("/", async (req, res, next) => {
  try {
    const { category, featured } = req.query;
    const isAdmin = !!req.headers.authorization;
    const where: any = {};
    if (!isAdmin) where.published = true;
    if (category && category !== "all") where.category = String(category);
    if (featured === "true") where.featured = true;
    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    ok(res, projects);
  } catch (e) {
    next(e);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: req.params.slug },
    });
    if (!project) throw new HttpError(404, "Project not found");
    ok(res, project);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    const slug = await uniqueSlug(data.title, async (s) =>
      !!(await prisma.project.findUnique({ where: { slug: s } }))
    );
    const project = await prisma.project.create({
      data: { ...data, tags: data.tags ?? [], slug },
    });
    emit("projects:changed", { action: "create", id: project.id });
    ok(res, project, 201);
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const data = upsertSchema.partial().parse(req.body);
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, "Project not found");
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
    });
    emit("projects:changed", { action: "update", id: project.id });
    ok(res, project);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    emit("projects:changed", { action: "delete", id: req.params.id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
