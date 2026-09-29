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