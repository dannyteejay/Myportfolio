# ===============================================================
#  Digital product delivery: buyers can download after payment
#  Run from repo root:
#    cd C:\Users\USER\Downloads\portfolio\portfolio
#    powershell -ExecutionPolicy Bypass -File .\apply-downloads.ps1
# ===============================================================
$ErrorActionPreference = "Stop"
$enc = New-Object System.Text.UTF8Encoding $false   # UTF-8 WITHOUT BOM
$root = $PWD

function Write-NoBom($rel, $text) {
  $full = Join-Path $root $rel
  $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $text = $text.TrimStart([char]0xFEFF)
  [System.IO.File]::WriteAllText($full, $text, $enc)
  Write-Host ("wrote (no BOM): " + $rel) -ForegroundColor Green
}

$uploadsFile = @'
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../auth.js";
import { ok, HttpError } from "../utils.js";

const router = Router();

// Use Cloudinary when configured (permanent CDN storage), otherwise fall back
// to local disk (fine for local dev; ephemeral on hosts like Render).
const cloudinaryEnabled =
  !!process.env.CLOUDINARY_URL ||
  (!!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET);

// If CLOUDINARY_URL is set the SDK auto-configures; otherwise configure manually.
if (cloudinaryEnabled && !process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

// Keep the file in memory so we can send it to Cloudinary or write it to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Unsupported file type") as any);
  },
});

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "portfolio", resource_type: "auto" },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Upload failed"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");

    let url: string;
    if (cloudinaryEnabled) {
      url = await uploadToCloudinary(req.file.buffer);
    } else {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const name = crypto.randomBytes(12).toString("hex") + ext;
      fs.writeFileSync(path.join(uploadDir, name), req.file.buffer);
      url = `/uploads/${name}`;
    }

    ok(res, { url }, 201);
  } catch (e) {
    next(e);
  }
});

// Larger, unrestricted upload for downloadable product files (zip, pdf, etc.)
const productFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.post(
  "/file",
  requireAuth,
  productFileUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "No file uploaded");
      let url: string;
      if (cloudinaryEnabled) {
        url = await uploadToCloudinary(req.file.buffer);
      } else {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const name = crypto.randomBytes(12).toString("hex") + ext;
        fs.writeFileSync(path.join(uploadDir, name), req.file.buffer);
        url = `/uploads/${name}`;
      }
      ok(res, { url }, 201);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
'@
Write-NoBom 'server/src/routes/uploads.ts' $uploadsFile

$paymentsFile = @'
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
    emit("settings:changed", {});
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

/* ----------------------------- Digital delivery ---------------------------- */
// Info endpoint so the success page knows whether a download is available.
router.get("/access/:reference", async (req, res, next) => {
  try {
    const { reference } = req.params;
    const order = await prisma.order.findUnique({ where: { reference } });
    if (!order) throw new HttpError(404, "Order not found");
    let hasFile = false;
    let title = order.productTitle;
    if (order.productId) {
      const product = await prisma.product.findUnique({
        where: { id: order.productId },
      });
      hasFile = Boolean(product?.fileUrl);
      if (product?.title) title = product.title;
    }
    ok(res, {
      status: order.status,
      paid: order.status === "paid",
      title,
      hasFile,
    });
  } catch (e) {
    next(e);
  }
});

// Secure download: only works once the order is paid; redirects to the file.
router.get("/download/:reference", async (req, res, next) => {
  try {
    const { reference } = req.params;
    const order = await prisma.order.findUnique({ where: { reference } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "paid") {
      throw new HttpError(403, "This order has not been paid yet.");
    }
    if (!order.productId) {
      throw new HttpError(404, "No product is linked to this order.");
    }
    const product = await prisma.product.findUnique({
      where: { id: order.productId },
    });
    if (!product?.fileUrl) {
      throw new HttpError(
        404,
        "No downloadable file is attached to this product yet. Please contact support."
      );
    }
    return res.redirect(302, product.fileUrl);
  } catch (e) {
    next(e);
  }
});

export default router;
'@
Write-NoBom 'server/src/routes/payments.ts' $paymentsFile

$queriesFile = @'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Message,
  Order,
  OrderStatus,
  PaymentMethods,
  PaymentSettings,
  Product,
  Profile,
  Project,
  Skill,
} from "../lib/types";

/* ---------------- Projects ---------------- */
export function useProjects(params?: { category?: string; admin?: boolean }) {
  const category = params?.category ?? "all";
  const admin = params?.admin ?? false;
  return useQuery({
    queryKey: ["projects", { category, admin }],
    queryFn: () =>
      api<Project[]>(
        `/projects?category=${category}`,
        admin ? { auth: true } : undefined
      ),
  });
}

export function useProject(slug: string) {
  return useQuery({
    queryKey: ["projects", slug],
    queryFn: () => api<Project>(`/projects/${slug}`),
    enabled: !!slug,
  });
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Project> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Project>(`/projects/${id}`, { method: "PUT", body, auth: true })
        : api<Project>(`/projects`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/projects/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/* ---------------- Products ---------------- */
export function useProducts(admin = false) {
  return useQuery({
    queryKey: ["products", { admin }],
    queryFn: () =>
      api<Product[]>(`/products`, admin ? { auth: true } : undefined),
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Product> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Product>(`/products/${id}`, { method: "PUT", body, auth: true })
        : api<Product>(`/products`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/products/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

/* ---------------- Skills ---------------- */
export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api<Skill[]>(`/skills`),
  });
}

export function useSaveSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Skill> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Skill>(`/skills/${id}`, { method: "PUT", body, auth: true })
        : api<Skill>(`/skills`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/skills/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

/* ---------------- Profile ---------------- */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile | null>(`/profile`),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Profile>) =>
      api<Profile>(`/profile`, { method: "PUT", body, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* ---------------- Messages ---------------- */
export function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: () => api<Message[]>(`/messages`, { auth: true }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      subject?: string;
      body: string;
    }) => api(`/messages`, { method: "POST", body }),
  });
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/messages/${id}/read`, { method: "PUT", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/messages/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

/* ---------------- Payments ---------------- */
export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => api<PaymentMethods>(`/payments/methods`),
    // Always get fresh availability so toggling a gateway in the admin
    // reflects immediately when a buyer opens checkout.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: () => api<PaymentSettings>(`/payments/settings`, { auth: true }),
  });
}

export function useSavePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PaymentSettings>) =>
      api<PaymentSettings>(`/payments/settings`, {
        method: "PUT",
        body,
        auth: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-settings"] });
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>(`/payments/orders`, { auth: true }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      api<Order>(`/payments/orders/${id}/status`, {
        method: "PUT",
        body: { status, note },
        auth: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/payments/orders/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

/* ---------------- Uploads ---------------- */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await api<{ url: string }>(`/uploads`, {
    method: "POST",
    body: fd,
    auth: true,
    isForm: true,
  });
  return data.url;
}

// Upload a downloadable product file (zip, pdf, etc.) — larger, no image filter.
export async function uploadProductFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await api<{ url: string }>(`/uploads/file`, {
    method: "POST",
    body: fd,
    auth: true,
    isForm: true,
  });
  return data.url;
}
'@
Write-NoBom 'client/src/hooks/queries.ts' $queriesFile

$uiFile = @'
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { uploadFile, uploadProductFile } from "../../hooks/queries";
import { useToast } from "../Toast";
import { IconUpload, IconX, IconTrash } from "../Icons";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-heading sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`card my-8 w-full ${wide ? "max-w-2xl" : "max-w-lg"} p-6`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-heading">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-6 text-center"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/15 text-red-300">
          <IconTrash className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold text-heading">{title}</h3>
        <p className="mt-2 text-sm text-ink-400">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn-danger flex-1"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
      toast("Image uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className="relative overflow-hidden rounded-xl ring-1 ring-line/10">
          <img src={value} alt="" className="aspect-[16/9] w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger btn-sm absolute right-2 top-2 !px-2"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload image"}
          </span>
          <span className="text-xs text-ink-500">PNG, JPG, WebP, SVG up to 8MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2">
        <input
          className="input text-xs"
          placeholder="…or paste an image URL"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    </div>
  );
}

export function FileUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadProductFile(file);
      onChange(url);
      toast("File uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  const fileName = value ? value.split("/").pop() : "";

  return (
    <div>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-line/5 px-3 py-2 ring-1 ring-line/10">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-brand-300 hover:underline"
            title={value}
          >
            {fileName || "Attached file"}
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger btn-sm !px-2"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 py-6 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload product file"}
          </span>
          <span className="text-xs text-ink-500">ZIP, PDF, etc. up to 50MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2">
        <input
          className="input text-xs"
          placeholder="…or paste a direct download URL"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    </div>
  );
}

export function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink-950/70 p-2 ring-1 ring-line/10">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-200"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="text-brand-300 hover:text-heading"
            >
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add tag + Enter"
          className="flex-1 bg-transparent px-2 py-1 text-sm text-heading outline-none placeholder:text-ink-500"
        />
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-brand-500" : "bg-line/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-ink-200">{label}</span>
    </button>
  );
}
'@
Write-NoBom 'client/src/components/admin/ui.tsx' $uiFile

$adminProd = @'
import { useState } from "react";
import {
  useDeleteProduct,
  useProducts,
  useSaveProduct,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import { formatMoney } from "../../lib/format";
import {
  ConfirmDialog,
  Field,
  FileUpload,
  ImageUpload,
  Modal,
  PageHeader,
  TagsInput,
  Toggle,
} from "../../components/admin/ui";
import { IconEdit, IconPlus, IconTrash } from "../../components/Icons";
import type { Product } from "../../lib/types";

type Draft = Partial<Product> & { priceMajor?: number };

const empty: Draft = {
  title: "",
  description: "",
  price: 0,
  priceMajor: 0,
  currency: "NGN",
  coverImage: "",
  fileUrl: "",
  tags: [],
  published: true,
  order: 0,
};

export default function AdminProducts() {
  const { data: products, isLoading } = useProducts(true);
  const save = useSaveProduct();
  const del = useDeleteProduct();
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function startEdit(p: Product) {
    setEditing({ ...p, priceMajor: p.price / 100 });
  }

  async function handleSave() {
    if (!editing?.title || !editing.description) {
      return toast("Title and description are required", "error");
    }
    const { priceMajor, ...rest } = editing;
    const payload = {
      ...rest,
      price: Math.round((priceMajor ?? 0) * 100),
    };
    try {
      await save.mutateAsync(payload);
      toast(editing.id ? "Product updated" : "Product created");
      setEditing(null);
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await del.mutateAsync(id);
      toast("Product deleted");
    } catch (e: any) {
      toast(e.message ?? "Failed to delete", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage digital products and templates sold in your store."
        action={
          <button onClick={() => setEditing({ ...empty })} className="btn-primary">
            <IconPlus className="h-4 w-4" />
            New product
          </button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/5" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {(products ?? []).map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-line/5">
                {p.coverImage && (
                  <img
                    src={p.coverImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-heading">{p.title}</h3>
                <p className="truncate text-sm text-ink-400">{p.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-bold text-brand-200">
                    {formatMoney(p.price, p.currency)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      p.published
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-line/5 text-ink-400"
                    }`}
                  >
                    {p.published ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="btn-ghost btn-sm !px-2.5"
                >
                  <IconEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteId(p.id)}
                  className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(!products || products.length === 0) && (
            <div className="card py-16 text-center text-ink-400">
              No products yet.
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal
          wide
          title={editing.id ? "Edit product" : "New product"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <Field label="Title">
              <input
                className="input"
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className="input min-h-[100px] resize-y"
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price" hint="In major units (e.g. Naira)">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={editing.priceMajor ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, priceMajor: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Currency">
                <select
                  className="input"
                  value={editing.currency}
                  onChange={(e) =>
                    setEditing({ ...editing, currency: e.target.value })
                  }
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GHS">GHS (₵)</option>
                  <option value="KES">KES</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </Field>
            </div>
            <Field label="Cover image">
              <ImageUpload
                value={editing.coverImage}
                onChange={(url) => setEditing({ ...editing, coverImage: url })}
              />
            </Field>
            <Field
              label="Product file (download)"
              hint="Buyers can download this after a successful payment"
            >
              <FileUpload
                value={editing.fileUrl}
                onChange={(url) => setEditing({ ...editing, fileUrl: url })}
              />
            </Field>
            <Field label="Tags">
              <TagsInput
                value={editing.tags ?? []}
                onChange={(tags) => setEditing({ ...editing, tags })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display order">
                <input
                  type="number"
                  className="input"
                  value={editing.order ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, order: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="flex items-end pb-2.5">
                <Toggle
                  checked={!!editing.published}
                  onChange={(v) => setEditing({ ...editing, published: v })}
                  label="Published"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={save.isPending}
                className="btn-primary"
              >
                {save.isPending ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete product?"
          message="This will permanently remove the product from your store."
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
'@
Write-NoBom 'client/src/pages/admin/AdminProducts.tsx' $adminProd

$callbackFile = @'
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { Spinner } from "../components/Loader";
import { IconArrowRight, IconCheck, IconX } from "../components/Icons";

type State = "loading" | "paid" | "pending" | "failed";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const [state, setState] = useState<State>("loading");
  const [hasFile, setHasFile] = useState(false);

  const gateway = params.get("gateway") ?? "";
  // Paystack returns ?reference=, Flutterwave ?transaction_id=&tx_ref=&status=
  const reference =
    params.get("reference") || params.get("tx_ref") || params.get("order_id");
  const transactionId = params.get("transaction_id");
  const cryptoStatus = params.get("status");

  useEffect(() => {
    (async () => {
      // Crypto/bank are confirmed asynchronously (webhook / admin)
      if (gateway === "crypto") {
        setState(cryptoStatus === "success" ? "pending" : "failed");
        return;
      }
      try {
        const q = new URLSearchParams({ gateway });
        if (reference) q.set("reference", reference);
        if (transactionId) q.set("transaction_id", transactionId);
        const res = await api<{ status: string }>(
          `/payments/verify?${q.toString()}`
        );
        if (res.status === "paid") {
          setState("paid");
          // Check whether a downloadable file is attached to this order.
          if (reference) {
            try {
              const access = await api<{ hasFile: boolean }>(
                `/payments/access/${reference}`
              );
              setHasFile(Boolean(access.hasFile));
            } catch {
              /* no download info available */
            }
          }
        } else if (res.status === "failed" || res.status === "cancelled")
          setState("failed");
        else setState("pending");
      } catch {
        setState("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = {
    loading: {
      title: "Verifying payment…",
      body: "Please wait while we confirm your transaction.",
    },
    paid: {
      title: "Payment successful! 🎉",
      body: hasFile
        ? "Thank you for your purchase. Click the button below to download your product. Keep your reference in case you need to download again."
        : "Thank you for your purchase. Your order is confirmed — if this product has a downloadable file it will appear here, otherwise you'll be contacted with access details.",
    },
    pending: {
      title: "Payment pending",
      body: "We've received your order and are awaiting confirmation. You'll get an email as soon as it's confirmed.",
    },
    failed: {
      title: "Payment not completed",
      body: "Your payment didn't go through or was cancelled. You can try again from the store.",
    },
  }[state];

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8 text-center"
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full">
          {state === "loading" && <Spinner className="h-10 w-10" />}
          {state === "paid" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <IconCheck className="h-8 w-8" />
            </span>
          )}
          {state === "pending" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 text-amber-300 font-display text-2xl font-bold">
              …
            </span>
          )}
          {state === "failed" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-300">
              <IconX className="h-8 w-8" />
            </span>
          )}
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold text-heading">
          {config.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{config.body}</p>

        {reference && (
          <p className="mt-4 rounded-lg bg-line/5 px-3 py-2 text-xs text-ink-400">
            Reference: <span className="text-ink-200">{reference}</span>
          </p>
        )}

        {state === "paid" && hasFile && reference && (
          <a
            href={`/api/payments/download/${reference}`}
            className="btn-primary mt-6 w-full justify-center"
          >
            Download your product
            <IconArrowRight className="h-4 w-4" />
          </a>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/store" className="btn-ghost">
            Back to store
          </Link>
          <Link to="/" className="btn-primary">
            Go home
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
'@
Write-NoBom 'client/src/pages/PaymentCallback.tsx' $callbackFile

Write-Host ""
Write-Host "Done. Now: git add -A ; git commit -m \"Digital product delivery (download after payment)\" ; git push" -ForegroundColor Cyan
