import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { ok } from "../utils.js";
import { emit } from "../realtime.js";

const router = Router();

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional(),
  body: z.string().min(1),
});

// Public: submit a contact message
router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const msg = await prisma.message.create({ data });
    emit("messages:changed", { action: "create", id: msg.id });
    ok(res, { success: true }, 201);
  } catch (e) {
    next(e);
  }
});

// Admin
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
    });
    ok(res, messages);
  } catch (e) {
    next(e);
  }
});

router.put("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const msg = await prisma.message.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    emit("messages:changed", { action: "update", id: msg.id });
    ok(res, msg);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.message.delete({ where: { id: req.params.id } });
    emit("messages:changed", { action: "delete", id: req.params.id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
