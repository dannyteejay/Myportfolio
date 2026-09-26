import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { HttpError, ok, uniqueSlug } from "../utils.js";
import { emit } from "../realtime.js";

const router = Router();

const upsertSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().min(0),
  currency: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  order: z.number().int().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const isAdmin = !!req.headers.authorization;
    const where = isAdmin ? {} : { published: true };
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    ok(res, products);
  } catch (e) {
    next(e);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
    });
    if (!product) throw new HttpError(404, "Product not found");
    ok(res, product);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    const slug = await uniqueSlug(data.title, async (s) =>
      !!(await prisma.product.findUnique({ where: { slug: s } }))
    );
    const product = await prisma.product.create({
      data: { ...data, tags: data.tags ?? [], slug },
    });
    emit("products:changed", { action: "create", id: product.id });
    ok(res, product, 201);
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const data = upsertSchema.partial().parse(req.body);
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, "Product not found");
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });
    emit("products:changed", { action: "update", id: product.id });
    ok(res, product);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    emit("products:changed", { action: "delete", id: req.params.id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
