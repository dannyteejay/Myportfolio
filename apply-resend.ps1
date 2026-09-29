# ===============================================================
#  Switch email from Gmail SMTP -> Resend HTTPS API
#  Run from repo root:
#    cd C:\Users\USER\Downloads\portfolio\portfolio
#    powershell -ExecutionPolicy Bypass -File .\apply-resend.ps1
# ===============================================================
$ErrorActionPreference = "Stop"
$enc = New-Object System.Text.UTF8Encoding $false   # UTF-8 WITHOUT BOM
$root = $PWD

function Write-NoBom($rel, $text) {
  $full = Join-Path $root $rel
  $text = $text.TrimStart([char]0xFEFF)
  [System.IO.File]::WriteAllText($full, $text, $enc)
  Write-Host "wrote (no BOM): $rel" -ForegroundColor Green
}

$mailer = @'
import { env } from "./env.js";

// Email is sent via the Resend HTTPS API (port 443) instead of SMTP, because
// Render's free tier blocks outbound SMTP ports (25/465/587). If no API key is
// configured we log the link instead of sending, so the flow still works.
const enabled = Boolean(env.RESEND_API_KEY);

export function mailerEnabled() {
  return enabled;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!enabled) {
    console.warn(
      "[mailer] RESEND_API_KEY not set. Password reset link (copy manually):",
      resetUrl
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to,
      subject: "Reset your admin password",
      text:
        `You requested a password reset for your portfolio admin account.\n\n` +
        `Open this link to set a new password (valid for 1 hour):\n${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
      html:
        `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">` +
        `<h2 style="color:#111">Reset your admin password</h2>` +
        `<p>You requested a password reset for your portfolio admin account.</p>` +
        `<p><a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set a new password</a></p>` +
        `<p style="color:#666;font-size:13px">This link is valid for 1 hour. If the button doesn't work, paste this URL into your browser:</p>` +
        `<p style="color:#666;font-size:13px;word-break:break-all">${resetUrl}</p>` +
        `<p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email.</p>` +
        `</div>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend API error ${res.status}: ${detail}`);
  }
}
'@
Write-NoBom 'server\src\mailer.ts' $mailer

$envts = @'
import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev_access_secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev_refresh_secret"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "7"),
  PORT: Number(process.env.PORT ?? "4000"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "*",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@portfolio.dev",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "Admin123!",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "onboarding@resend.dev",
};
'@
Write-NoBom 'server\srcnv.ts' $envts

Write-Host ""
Write-Host "Done. Now: git add -A ; git commit -m 'Email via Resend API (Render free tier blocks SMTP)' ; git push" -ForegroundColor Cyan
