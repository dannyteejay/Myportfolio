import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { ok, HttpError } from "../utils.js";
import { emit } from "../realtime.js";
import {
  paystack,
  flutterwave,
  crypto_gw,
  genReference,
} from "../payments/gateways.js";

const router = Router();

async function getSettings() {
  let settings = await prisma.paymentSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await prisma.paymentSettings.create({
      data: { id: "singleton" },
    });
  }
  return settings;
}

/* -------- Public: which methods are available (no secrets exposed) --------- */
router.get("/methods", async (_req, res, next) => {
  try {
    const s = await getSettings();
    ok(res, {
      paystack: {
        enabled: s.paystackEnabled,
        configured: paystack.configured,
      },
      flutterwave: {
        enabled: s.flutterwaveEnabled,
        configured: flutterwave.configured,
      },
      crypto: {
        enabled: s.cryptoEnabled,
        configured: crypto_gw.configured,
        note: s.cryptoNote,
      },
      bank: {
        enabled: s.bankEnabled,
        bankName: s.bankName,
        bankAccountName: s.bankAccountName,
        bankAccountNumber: s.bankAccountNumber,
        instructions: s.bankInstructions,
      },
    });
  } catch (e) {
    next(e);
  }
});

const initSchema = z.object({
  productSlug: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
});

async function loadProduct(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.published)
    throw new HttpError(404, "Product not found");
  return product;
}

/* ------------------------------- Paystack ---------------------------------- */
router.post("/paystack/initialize", async (req, res, next) => {
  try {
    const { productSlug, email } = initSchema.parse(req.body);
    const s = await getSettings();
    if (!s.paystackEnabled) throw new HttpError(400, "Paystack is disabled");
    const product = await loadProduct(productSlug);
    const reference = genReference("PSK");

    const order = await prisma.order.create({
      data: {
        reference,
        productId: product.id,
        productTitle: product.title,
        email,
        amount: product.price,
        currency: product.currency,
        gateway: "paystack",
        status: "pending",
      },
    });
    emit("orders:changed", { action: "create", id: order.id });

    if (!paystack.configured) {
      return ok(res, {
        configured: false,
        reference,
        message:
          "Paystack is in demo mode. Set PAYSTACK_SECRET_KEY to enable live checkout.",
      });
    }
    const init = await paystack.initialize({
      email,
      amount: product.price,
      currency: product.currency,
      reference,
      metadata: { productSlug: product.slug, productTitle: product.title },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { providerRef: init.providerRef },
    });
    ok(res, { configured: true, authorization_url: init.url, reference });
  } catch (e) {
    next(e);
  }
});

/* ------------------------------ Flutterwave -------------------------------- */
router.post("/flutterwave/initialize", async (req, res, next) => {
  try {
    const { productSlug, email, name } = initSchema.parse(req.body);
    const s = await getSettings();
    if (!s.flutterwaveEnabled)
      throw new HttpError(400, "Flutterwave is disabled");
    const product = await loadProduct(productSlug);
    const reference = genReference("FLW");

    const order = await prisma.order.create({
      data: {
        reference,
        productId: product.id,
        productTitle: product.title,
        email,
        amount: product.price,
        currency: product.currency,
        gateway: "flutterwave",
        status: "pending",
      },
    });
    emit("orders:changed", { action: "create", id: order.id });

    if (!flutterwave.configured) {
      return ok(res, {
        configured: false,
        reference,
        message:
          "Flutterwave is in demo mode. Set FLUTTERWAVE_SECRET_KEY to enable live checkout.",
      });
    }
    const init = await flutterwave.initialize({
      email,
      name,
      amount: product.price,
      currency: product.currency,
      reference,
      metadata: { productSlug: product.slug },
    });
    ok(res, { configured: true, authorization_url: init.url, reference });
  } catch (e) {
    next(e);
  }
});

/* --------------------------------- Crypto ---------------------------------- */
router.post("/crypto/initialize", async (req, res, next) => {
  try {
    const { productSlug, email } = initSchema.parse(req.body);
    const s = await getSettings();
    if (!s.cryptoEnabled) throw new HttpError(400, "Crypto is disabled");
    const product = await loadProduct(productSlug);
    const reference = genReference("CRY");

    const order = await prisma.order.create({
      data: {
        reference,
        productId: product.id,
        productTitle: product.title,
        email,
        amount: product.price,
        currency: product.currency,
        gateway: "crypto",
        status: "pending",
      },
    });
    emit("orders:changed", { action: "create", id: order.id });

    if (!crypto_gw.configured) {
      return ok(res, {
        configured: false,
        reference,
        message:
          "Crypto is in demo mode. Set NOWPAYMENTS_API_KEY to enable live crypto invoices.",
        note: s.cryptoNote,
      });
    }
    const init = await crypto_gw.initialize({
      amount: product.price,
      currency: product.currency,
      reference,
      email,
      title: product.title,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { providerRef: init.providerRef },
    });
    ok(res, { configured: true, authorization_url: init.url, reference });
  } catch (e) {
    next(e);
  }
});

/* ------------------------------ Bank transfer ------------------------------ */
router.post("/bank/initialize", async (req, res, next) => {
  try {
    const { productSlug, email } = initSchema.parse(req.body);
    const s = await getSettings();
    if (!s.bankEnabled) throw new HttpError(400, "Bank transfer is disabled");
    if (!s.bankAccountNumber)
      throw new HttpError(400, "Bank details are not configured yet");
    const product = await loadProduct(productSlug);
    const reference = genReference("BNK");

    const order = await prisma.order.create({
      data: {
        reference,
        productId: product.id,
        productTitle: product.title,
        email,
        amount: product.price,
        currency: product.currency,
        gateway: "bank",
        status: "pending",
      },
    });
    emit("orders:changed", { action: "create", id: order.id });

    ok(res, {
      reference,
      bank: {
        bankName: s.bankName,
        bankAccountName: s.bankAccountName,
        bankAccountNumber: s.bankAccountNumber,
        instructions: s.bankInstructions,
      },
      amount: product.price,
      currency: product.currency,
    });
  } catch (e) {
    next(e);
  }
});

/* --------------------------- Verify (redirect back) ------------------------ */
router.get("/verify", async (req, res, next) => {
  try {
    const gateway = String(req.query.gateway ?? "");
    const reference = req.query.reference ? String(req.query.reference) : null;
    const transactionId = req.query.transaction_id
      ? String(req.query.transaction_id)
      : null;

    if (gateway === "paystack" && reference) {
      const order = await prisma.order.findUnique({ where: { reference } });
      if (!order) throw new HttpError(404, "Order not found");
      if (paystack.configured) {
        const result = await paystack.verify(reference);
        const status = result.paid ? "paid" : "failed";
        await prisma.order.update({ where: { reference }, data: { status } });
        emit("orders:changed", { action: "update", id: order.id });
        return ok(res, { status, order: { ...order, status } });
      }
      return ok(res, { status: order.status, order });
    }

    if (gateway === "flutterwave" && transactionId) {
      if (flutterwave.configured) {
        const result = await flutterwave.verify(transactionId);
        const ref = result.tx_ref;
        if (ref) {
          const order = await prisma.order.findUnique({
            where: { reference: ref },
          });
          if (order) {
            const status = result.paid ? "paid" : "failed";
            await prisma.order.update({
              where: { reference: ref },
              data: { status, providerRef: transactionId },
            });
            emit("orders:changed", { action: "update", id: order.id });
            return ok(res, { status, order: { ...order, status } });
          }
        }
      }
      return ok(res, { status: "pending" });
    }

    // crypto / bank: status is confirmed via webhook or admin
    if (reference) {
      const order = await prisma.order.findUnique({ where: { reference } });
      if (order) return ok(res, { status: order.status, order });
    }
    ok(res, { status: "pending" });
  } catch (e) {
    next(e);
  }
});

/* --------------------------------- Webhooks -------------------------------- */
// Raw body is captured in index.ts via express.json({ verify }) as req.rawBody
router.post("/webhook/paystack", async (req: any, res) => {
  const sig = req.headers["x-paystack-signature"] as string | undefined;
  if (!paystack.verifySignature(req.rawBody, sig)) {
    return res.status(401).send("invalid signature");
  }
  const event = req.body;
  if (event?.event === "charge.success") {
    const reference = event.data?.reference;
    if (reference) {
      await prisma.order
        .update({ where: { reference }, data: { status: "paid" } })
        .catch(() => {});
      emit("orders:changed", { action: "update", id: reference });
    }
  }
  res.sendStatus(200);
});

router.post("/webhook/flutterwave", async (req: any, res) => {
  const sig = req.headers["verif-hash"] as string | undefined;
  if (!flutterwave.verifySignature(sig)) {
    return res.status(401).send("invalid signature");
  }
  const data = req.body?.data;
  if (data?.status === "successful" && data?.tx_ref) {
    await prisma.order
      .update({ where: { reference: data.tx_ref }, data: { status: "paid" } })
      .catch(() => {});
    emit("orders:changed", { action: "update", id: data.tx_ref });
  }
  res.sendStatus(200);
});

router.post("/webhook/crypto", async (req: any, res) => {
  const sig = req.headers["x-nowpayments-sig"] as string | undefined;
  if (!crypto_gw.verifySignature(req.rawBody, sig)) {
    return res.status(401).send("invalid signature");
  }
  const body = req.body;
  const reference = body?.order_id;
  if (reference && ["finished", "confirmed"].includes(body?.payment_status)) {
    await prisma.order
      .update({ where: { reference }, data: { status: "paid" } })
      .catch(() => {});
    emit("orders:changed", { action: "update", id: reference });
  }
  res.sendStatus(200);
});

/* ----------------------------- Admin: settings ----------------------------- */
router.get("/settings", requireAuth, async (_req, res, next) => {
  try {
    ok(res, await getSettings());
  } catch (e) {
    next(e);
  }
});

const settingsSchema = z.object({
  paystackEnabled: z.boolean().optional(),
  flutterwaveEnabled: z.boolean().optional(),
  cryptoEnabled: z.boolean().optional(),
  bankEnabled: z.boolean().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankInstructions: z.string().nullable().optional(),
  cryptoNote: z.string().nullable().optional(),
});

router.put("/settings", requireAuth, async (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    await getSettings();
    const updated = await prisma.paymentSettings.update({
      where: { id: "singleton" },
      data,
    });
    emit("settings:changed", {});   // <-- ADD THIS LINE
    ok(res, updated);
  } catch (e) {
    next(e);
  }
});

/* ------------------------------ Admin: orders ------------------------------ */
router.get("/orders", requireAuth, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    ok(res, orders);
  } catch (e) {
    next(e);
  }
});

const statusSchema = z.object({
  status: z.enum(["pending", "paid", "failed", "cancelled"]),
  note: z.string().optional(),
});

router.put("/orders/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status, note } = statusSchema.parse(req.body);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, note },
    });
    emit("orders:changed", { action: "update", id: order.id });
    ok(res, order);
  } catch (e) {
    next(e);
  }
});

router.delete("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    emit("orders:changed", { action: "delete", id: req.params.id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
