import nodemailer from "nodemailer";
import { env } from "./env.js";

// Email is optional: if SMTP creds aren't configured we log the link instead
// of sending, so local/dev still works and the app never crashes.
const enabled = Boolean(env.SMTP_USER && env.SMTP_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export function mailerEnabled() {
  return enabled;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!transporter) {
    console.warn(
      "[mailer] SMTP not configured. Password reset link (copy manually):",
      resetUrl
    );
    return;
  }

  await transporter.sendMail({
    from: `"Portfolio Admin" <${env.SMTP_USER}>`,
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
  });
}
