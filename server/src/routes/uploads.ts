import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { requireAuth } from "../auth.js";
import { ok, HttpError } from "../utils.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});

const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Unsupported file type") as any);
  },
});

// NOTE: In production, swap this for Cloudinary/S3 upload and return the CDN URL.
router.post("/", requireAuth, upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const url = `/uploads/${req.file.filename}`;
    ok(res, { url }, 201);
  } catch (e) {
    next(e);
  }
});

export default router;
