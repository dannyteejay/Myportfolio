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
};
