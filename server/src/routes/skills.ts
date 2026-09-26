import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { HttpError, ok } from "../utils.js";
import { emit } from "../realtime.js";

const router = Router();

const schema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  level: z.number().int().min(0).max(100).optional(),
  order: z.number().int().optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    ok(res, skills);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const skill = await prisma.skill.create({ data });
    emit("skills:changed", { action: "create", id: skill.id });
    ok(res, skill, 201);
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body);
    const existing = await prisma.skill.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Skill not found");
    const skill = await prisma.skill.update({ where: { id: req.params.id }, data });
    emit("skills:changed", { action: "update", id: skill.id });
    ok(res, skill);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.skill.delete({ where: { id: req.params.id } });
    emit("skills:changed", { action: "delete", id: req.params.id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
