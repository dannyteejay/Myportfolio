# ===============================================================
#  Product image gallery: multiple store screenshots/previews
#  Run from repo root:
#    cd C:\Users\USER\Downloads\portfolio\portfolio
#    powershell -ExecutionPolicy Bypass -File .\apply-product-gallery.ps1
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

$schemaFile = @'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String         @id @default(cuid())
  email        String         @unique
  password     String
  name         String
  role         String         @default("ADMIN")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  refreshTokens RefreshToken[]
  passwordResetTokens PasswordResetToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Project {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  category    String   // "software" | "webdesign"
  summary     String
  description String
  coverImage  String?
  liveUrl     String?
  repoUrl     String?
  tags        String[] @default([])
  featured    Boolean  @default(false)
  published   Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Product {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String
  price       Int      // price in kobo (NGN minor units)
  currency    String   @default("NGN")
  coverImage  String?
  galleryImages String[] @default([]) // extra screenshots/previews for store products
  fileUrl     String?  // downloadable asset (for digital products)
  tags        String[] @default([])
  published   Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Skill {
  id        String   @id @default(cuid())
  name      String
  category  String   @default("general")
  level     Int      @default(80) // 0-100
  order     Int      @default(0)
  createdAt DateTime @default(now())
}

model Profile {
  id         String   @id @default("singleton")
  name       String
  title      String
  metaTitle  String?
  metaDescription String?
  tagline    String
  bio        String
  email      String
  location   String?
  avatar     String?
  githubUrl  String?
  linkedinUrl String?
  twitterUrl String?
  websiteUrl String?
  resumeUrl  String?
  updatedAt  DateTime @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  name      String
  email     String
  subject   String?
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Order {
  id           String   @id @default(cuid())
  reference    String   @unique
  productId    String?
  productTitle String
  email        String
  amount       Int // minor units (kobo/cents)
  currency     String   @default("NGN")
  gateway      String // paystack | flutterwave | crypto | bank
  status       String   @default("pending") // pending | paid | failed | cancelled
  providerRef  String? // gateway transaction id / invoice id
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PaymentSettings {
  id                 String  @id @default("singleton")
  paystackEnabled    Boolean @default(true)
  flutterwaveEnabled Boolean @default(true)
  cryptoEnabled      Boolean @default(true)
  bankEnabled        Boolean @default(true)
  bankName           String?
  bankAccountName    String?
  bankAccountNumber  String?
  bankInstructions   String?
  cryptoNote         String?
  updatedAt          DateTime @updatedAt
}
'@
Write-NoBom 'server/prisma/schema.prisma' $schemaFile

$productsFile = @'
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
  galleryImages: z.array(z.string()).optional(),
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
      data: {
        ...data,
        tags: data.tags ?? [],
        galleryImages: data.galleryImages ?? [],
        slug,
      },
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
'@
Write-NoBom 'server/src/routes/products.ts' $productsFile

$typesFile = @'
export interface Project {
  id: string;
  title: string;
  slug: string;
  category: "software" | "webdesign";
  summary: string;
  description: string;
  coverImage: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  tags: string[];
  featured: boolean;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number; // in kobo
  currency: string;
  coverImage: string | null;
  galleryImages: string[];
  fileUrl: string | null;
  tags: string[];
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: number;
  order: number;
}

export interface Profile {
  id: string;
  name: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tagline: string;
  bio: string;
  email: string;
  location: string | null;
  avatar: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  resumeUrl: string | null;
}

export interface Message {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type PaymentGateway = "paystack" | "flutterwave" | "crypto" | "bank";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";

export interface Order {
  id: string;
  reference: string;
  productId: string | null;
  productTitle: string;
  email: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: OrderStatus;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSettings {
  id: string;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  cryptoEnabled: boolean;
  bankEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
  cryptoNote: string | null;
}

export interface PaymentMethods {
  paystack: { enabled: boolean; configured: boolean };
  flutterwave: { enabled: boolean; configured: boolean };
  crypto: { enabled: boolean; configured: boolean; note: string | null };
  bank: {
    enabled: boolean;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    instructions: string | null;
  };
}
'@
Write-NoBom 'client/src/lib/types.ts' $typesFile

$iconsFile = @'
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const IconCode = (p: P) => (
  <svg {...base} {...p}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
);
export const IconLayout = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
);
export const IconGithub = (p: P) => (
  <svg {...base} {...p}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base} {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
);
export const IconLinkedin = (p: P) => (
  <svg {...base} {...p}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
);
export const IconTwitter = (p: P) => (
  <svg {...base} {...p}><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" /></svg>
);
export const IconMail = (p: P) => (
  <svg {...base} {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
);
export const IconMapPin = (p: P) => (
  <svg {...base} {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base} {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base} {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
export const IconLogout = (p: P) => (
  <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);
export const IconDashboard = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
);
export const IconBox = (p: P) => (
  <svg {...base} {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
export const IconInbox = (p: P) => (
  <svg {...base} {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
);
export const IconStar = (p: P) => (
  <svg {...base} {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} {...p}><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base} {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}><polyline points="20 6 9 17 4 12" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base} {...p}><path d="M12 3l1.9 5.8L20 10.7l-5.1 1.9L12 21l-1.9-8.4L5 10.7l6.1-1.9L12 3z" /></svg>
);
export const IconSun = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconMoon = (p: P) => (
  <svg {...base} {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
);
export const IconCard = (p: P) => (
  <svg {...base} {...p}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
);
export const IconBank = (p: P) => (
  <svg {...base} {...p}><line x1="3" y1="21" x2="21" y2="21" /><path d="M3 10h18" /><path d="M5 10v11M19 10v11M9 10v11M15 10v11" /><path d="M12 3 3 8h18z" /></svg>
);
export const IconCrypto = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 8h4a2 2 0 0 1 0 4h-4zM9.5 12h4.2a2 2 0 0 1 0 4H9.5zM9.5 8v8M11 6.5v1.5M11 16v1.5M13 6.5v1.5M13 16v1.5" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base} {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const IconReceipt = (p: P) => (
  <svg {...base} {...p}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>
);
export const IconImage = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-4.5-4.5L9 18" /></svg>
);
'@
Write-NoBom 'client/src/components/Icons.tsx' $iconsFile

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

export function GalleryImagesUpload({
  value,
  onChange,
}: {
  value: string[] | null | undefined;
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const toast = useToast();
  const images = value ?? [];

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file));
      }
      onChange([...images, ...uploaded]);
      toast(uploaded.length === 1 ? "Gallery image uploaded" : "Gallery images uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (images.includes(url)) {
      toast("That image is already in the gallery", "info");
      setUrlInput("");
      return;
    }
    onChange([...images, url]);
    setUrlInput("");
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Upload gallery images"}
          </span>
          <span className="text-xs text-ink-500">Select multiple screenshots</span>
        </button>
        <div className="rounded-xl bg-line/5 p-3 ring-1 ring-line/10">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Paste image URL
          </label>
          <div className="flex gap-2">
            <input
              className="input text-xs"
              placeholder="https://example.com/screenshot.png"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
            />
            <button type="button" onClick={addUrl} className="btn-ghost btn-sm">
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Use this for externally hosted screenshots.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files) handleFiles(files);
          e.target.value = "";
        }}
      />

      {images.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="overflow-hidden rounded-xl bg-line/5 ring-1 ring-line/10">
              <div className="relative aspect-[16/9] bg-ink-950/70">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="btn-danger btn-sm absolute right-2 top-2 !px-2"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-ink-400" title={url}>
                  Image {index + 1}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn-ghost btn-sm !px-2 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    className="btn-ghost btn-sm !px-2 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-line/5 p-3 text-sm text-ink-500 ring-1 ring-line/10">
          No gallery images yet. Add screenshots of the homepage, admin dashboard,
          mobile view, checkout flow, or any feature buyers should see.
        </p>
      )}
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
  GalleryImagesUpload,
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
  galleryImages: [],
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
    setEditing({
      ...p,
      galleryImages: p.galleryImages ?? [],
      priceMajor: p.price / 100,
    });
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
                {(p.coverImage || p.galleryImages?.[0]) && (
                  <img
                    src={p.coverImage || p.galleryImages?.[0]}
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
                  {(p.galleryImages?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-line/5 px-2 py-0.5 font-medium text-ink-300">
                      {p.galleryImages.length} gallery image
                      {p.galleryImages.length === 1 ? "" : "s"}
                    </span>
                  )}
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
            <Field
              label="Cover image"
              hint="Main thumbnail shown on the store card. If empty, the first gallery image is used."
            >
              <ImageUpload
                value={editing.coverImage}
                onChange={(url) => setEditing({ ...editing, coverImage: url })}
              />
            </Field>
            <Field
              label="Gallery images"
              hint="Add multiple screenshots/previews. These are shown on the store page preview modal."
            >
              <GalleryImagesUpload
                value={editing.galleryImages ?? []}
                onChange={(galleryImages) =>
                  setEditing({ ...editing, galleryImages })
                }
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

$storeFile = @'
import { useState } from "react";
import { motion } from "framer-motion";
import { usePaymentMethods, useProducts } from "../hooks/queries";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";
import { CardSkeleton } from "../components/Loader";
import { useToast } from "../components/Toast";
import {
  IconBank,
  IconCard,
  IconCart,
  IconCopy,
  IconCrypto,
  IconImage,
  IconX,
} from "../components/Icons";
import type { PaymentGateway, PaymentMethods, Product } from "../lib/types";

function productImages(product: Product) {
  const urls = [product.coverImage, ...(product.galleryImages ?? [])].filter(
    (url): url is string => Boolean(url)
  );
  return Array.from(new Set(urls));
}

export default function Store() {
  const { data: products, isLoading } = useProducts();
  const [checkout, setCheckout] = useState<Product | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);

  return (
    <div className="pt-32 pb-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
            Digital store
          </p>
          <h1 className="section-title mt-2 !text-4xl sm:!text-5xl">
            Templates & digital products
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">
            Production-ready templates and UI kits to help you ship faster. Pay
            with card, bank transfer or cryptocurrency.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          ) : products && products.length > 0 ? (
            products.map((p, i) => {
              const images = productImages(p);
              const mainImage = images[0];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.08 }}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-ink-900/60 ring-1 ring-line/10 transition-all hover:-translate-y-1 hover:ring-brand-400/40"
                >
                  <button
                    type="button"
                    onClick={() => setPreview(p)}
                    className="relative aspect-[16/10] overflow-hidden text-left"
                  >
                    {mainImage ? (
                      <img
                        src={mainImage}
                        alt={p.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center font-display font-bold text-white">
                        {p.title}
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                      {formatMoney(p.price, p.currency)}
                    </div>
                    {images.length > 1 && (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        <IconImage className="h-3.5 w-3.5" />
                        {images.length} screenshots
                      </div>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-lg font-bold text-heading">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-400">
                      {p.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    {images.length > 1 && (
                      <div className="mt-4 flex gap-2 overflow-hidden">
                        {images.slice(0, 4).map((url, index) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setPreview(p)}
                            className="h-12 flex-1 overflow-hidden rounded-lg bg-line/5 ring-1 ring-line/10 transition hover:ring-brand-400/50"
                            title={`Preview screenshot ${index + 1}`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview(p)}
                        className="btn-ghost justify-center"
                      >
                        <IconImage className="h-4 w-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => setCheckout(p)}
                        className="btn-primary justify-center"
                      >
                        <IconCart className="h-4 w-4" />
                        Buy now
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center text-ink-400">
              No products available yet.
            </div>
          )}
        </div>
      </div>

      {preview && (
        <ProductPreviewModal
          product={preview}
          onClose={() => setPreview(null)}
          onBuy={(product) => {
            setPreview(null);
            setCheckout(product);
          }}
        />
      )}

      {checkout && (
        <CheckoutModal product={checkout} onClose={() => setCheckout(null)} />
      )}
    </div>
  );
}

/* ------------------------------ Product preview ---------------------------- */

function ProductPreviewModal({
  product,
  onClose,
  onBuy,
}: {
  product: Product;
  onClose: () => void;
  onBuy: (product: Product) => void;
}) {
  const images = productImages(product);
  const [active, setActive] = useState(0);
  const current = images[active];

  function showNext() {
    if (images.length < 2) return;
    setActive((active + 1) % images.length);
  }

  function showPrev() {
    if (images.length < 2) return;
    setActive((active - 1 + images.length) % images.length);
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card my-8 w-full max-w-5xl overflow-hidden p-0"
      >
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="bg-ink-950/50 p-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800">
              {current ? (
                <img
                  src={current}
                  alt={`${product.title} screenshot ${active + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center p-8 text-center font-display text-3xl font-bold text-white">
                  {product.title}
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Previous screenshot"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Next screenshot"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {active + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setActive(index)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                      active === index
                        ? "ring-brand-400"
                        : "ring-line/10 hover:ring-line/30"
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
                  Product preview
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold text-heading">
                  {product.title}
                </h3>
              </div>
              <button onClick={onClose} className="btn-ghost btn-sm !px-2">
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-300">
              {product.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-line/5 p-4 ring-1 ring-line/10">
              <p className="text-xs uppercase tracking-wide text-ink-500">Price</p>
              <p className="mt-1 font-display text-3xl font-bold text-heading">
                {formatMoney(product.price, product.currency)}
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Secure checkout. Your download becomes available after a
                successful payment.
              </p>
            </div>

            <div className="mt-auto pt-6">
              <button onClick={() => onBuy(product)} className="btn-primary w-full">
                <IconCart className="h-4 w-4" />
                Buy now
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------ Checkout modal ----------------------------- */

const GATEWAY_META: Record<
  PaymentGateway,
  { label: string; desc: string; icon: JSX.Element }
> = {
  paystack: {
    label: "Card / Paystack",
    desc: "Debit or credit card, USSD, bank",
    icon: <IconCard className="h-5 w-5" />,
  },
  flutterwave: {
    label: "Flutterwave",
    desc: "Card, mobile money, bank transfer",
    icon: <IconCard className="h-5 w-5" />,
  },
  crypto: {
    label: "Cryptocurrency",
    desc: "BTC, ETH, USDT and more",
    icon: <IconCrypto className="h-5 w-5" />,
  },
  bank: {
    label: "Direct bank transfer",
    desc: "Pay to our bank account",
    icon: <IconBank className="h-5 w-5" />,
  },
};

function availableGateways(m: PaymentMethods): PaymentGateway[] {
  const list: PaymentGateway[] = [];
  if (m.paystack.enabled) list.push("paystack");
  if (m.flutterwave.enabled) list.push("flutterwave");
  if (m.crypto.enabled) list.push("crypto");
  if (m.bank.enabled) list.push("bank");
  return list;
}

function CheckoutModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data: methods } = usePaymentMethods();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState<any | null>(null);
  const toast = useToast();

  const gateways = methods ? availableGateways(methods) : [];
  const thumbnail = productImages(product)[0];

  async function handlePay() {
    if (!email) return toast("Please enter your email", "error");
    if (!gateway) return toast("Please choose a payment method", "error");
    setLoading(true);
    try {
      const res = await api<any>(`/payments/${gateway}/initialize`, {
        method: "POST",
        body: { productSlug: product.slug, email, name },
      });

      if (gateway === "bank") {
        setBankInfo({ ...res.bank, reference: res.reference });
        return;
      }

      if (res.configured && res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        toast(
          res.message ??
            "This gateway is in demo mode. Add its API key on the server to go live.",
          "info"
        );
      }
    } catch (e: any) {
      toast(e.message ?? "Checkout failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card my-8 w-full max-w-md p-6"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display text-xl font-bold text-heading">
            {bankInfo ? "Bank transfer" : "Checkout"}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Product summary */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-line/5 p-3 ring-1 ring-line/10">
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              className="h-14 w-20 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-heading">{product.title}</p>
            <p className="text-sm font-bold text-brand-300">
              {formatMoney(product.price, product.currency)}
            </p>
          </div>
        </div>

        {bankInfo ? (
          <BankInstructions
            bank={bankInfo}
            amount={product.price}
            currency={product.currency}
            onDone={onClose}
          />
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email for receipt *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Payment method</label>
              <div className="grid gap-2">
                {gateways.length === 0 && (
                  <p className="rounded-xl bg-line/5 p-3 text-sm text-ink-400">
                    No payment methods are currently enabled.
                  </p>
                )}
                {gateways.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGateway(g)}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition-all ${
                      gateway === g
                        ? "bg-brand-500/15 ring-brand-400/50"
                        : "bg-line/5 ring-line/10 hover:ring-line/20"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        gateway === g
                          ? "bg-brand-500 text-white"
                          : "bg-line/5 text-ink-300"
                      }`}
                    >
                      {GATEWAY_META[g].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-heading">
                        {GATEWAY_META[g].label}
                      </span>
                      <span className="block text-xs text-ink-400">
                        {GATEWAY_META[g].desc}
                      </span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        gateway === g
                          ? "border-brand-400 bg-brand-400"
                          : "border-line/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className="btn-primary mt-5 w-full"
            >
              {loading
                ? "Processing…"
                : `Pay ${formatMoney(product.price, product.currency)}`}
            </button>
            <p className="mt-3 text-center text-xs text-ink-500">
              Payments are secured by the selected provider.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

function BankInstructions({
  bank,
  amount,
  currency,
  onDone,
}: {
  bank: any;
  amount: number;
  currency: string;
  onDone: () => void;
}) {
  const toast = useToast();
  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    toast("Copied to clipboard");
  }
  const rows = [
    { label: "Bank", value: bank.bankName },
    { label: "Account name", value: bank.bankAccountName },
    { label: "Account number", value: bank.bankAccountNumber },
    { label: "Amount", value: formatMoney(amount, currency) },
    { label: "Reference", value: bank.reference },
  ].filter((r) => r.value);

  return (
    <div className="mt-5">
      <p className="text-sm text-ink-300">
        Transfer the exact amount to the account below, using the reference as
        your narration.
      </p>
      <div className="mt-4 divide-y divide-line/5 rounded-xl bg-line/5 ring-1 ring-line/10">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between p-3">
            <span className="text-xs uppercase tracking-wide text-ink-500">
              {r.label}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-heading">
              {r.value}
              <button
                onClick={() => copy(String(r.value))}
                className="text-ink-400 hover:text-heading"
              >
                <IconCopy className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
      {bank.instructions && (
        <p className="mt-4 rounded-xl bg-brand-500/10 p-3 text-xs leading-relaxed text-brand-100 ring-1 ring-brand-400/20">
          {bank.instructions}
        </p>
      )}
      <button onClick={onDone} className="btn-primary mt-5 w-full">
        I've made the transfer
      </button>
    </div>
  );
}
'@
Write-NoBom 'client/src/pages/Store.tsx' $storeFile

Write-Host ""
Write-Host 'Done. Next run: git add -A ; git commit -m "Add product image gallery" ; git push' -ForegroundColor Cyan
