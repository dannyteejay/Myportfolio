# ===============================================================
#  Light mode contrast fix: sharper text, badges, and toast messages
#  Run from repo root:
#    cd C:\Users\USER\Downloads\portfolio\portfolio
#    powershell -ExecutionPolicy Bypass -File .\apply-lightmode-contrast.ps1
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

$cssFile = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ---------------------------------------------------------------------------
   Theme tokens. Light is the default (:root); .dark overrides for dark mode.
   Values are space-separated RGB channels so Tailwind's rgb(var() / alpha)
   syntax works (e.g. bg-ink-900/60, ring-line/10).
--------------------------------------------------------------------------- */
:root {
  color-scheme: light;

  --ink-50: 15 20 32;
  --ink-100: 17 24 39;
  --ink-200: 36 44 60;
  --ink-300: 45 55 72;
  --ink-400: 55 65 81;
  --ink-500: 75 85 99;
  --ink-600: 100 116 139;
  --ink-700: 203 209 219;
  --ink-800: 226 230 236;
  --ink-900: 255 255 255;
  --ink-950: 247 248 250;

  --heading: 12 18 32;
  --line: 15 23 42;

  --nav-bg: 255 255 255;
  --nav-alpha: 0.72;

  --grad-1: 30 59 245;
  --grad-2: 53 93 255;
  --grad-3: 124 58 237;
}

.dark {
  color-scheme: dark;

  --ink-50: 246 247 249;
  --ink-100: 236 238 242;
  --ink-200: 213 217 226;
  --ink-300: 176 184 200;
  --ink-400: 133 146 168;
  --ink-500: 102 115 141;
  --ink-600: 81 92 116;
  --ink-700: 66 75 94;
  --ink-800: 58 65 80;
  --ink-900: 11 15 26;
  --ink-950: 6 8 17;

  --heading: 248 250 252;
  --line: 255 255 255;

  --nav-bg: 6 8 17;
  --nav-alpha: 0.7;

  --grad-1: 142 177 255;
  --grad-2: 90 134 255;
  --grad-3: 167 139 255;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-ink-950 text-ink-100 font-sans antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Selection */
::selection {
  background: rgba(53, 93, 255, 0.28);
  color: rgb(var(--heading));
}

/* Light-mode contrast helpers.
   Several UI elements use soft dark-mode colors such as text-brand-200 or
   text-emerald-300. Those become pastel on white backgrounds, so in light mode
   we remap them to stronger accessible shades while leaving dark mode intact. */
html:not(.dark) .text-brand-200,
html:not(.dark) .text-brand-300,
html:not(.dark) .text-brand-400 {
  color: #1d4ed8 !important;
}

html:not(.dark) .hover\:text-brand-200:hover,
html:not(.dark) .hover\:text-brand-300:hover,
html:not(.dark) .hover\:text-brand-400:hover {
  color: #1e40af !important;
}

html:not(.dark) .text-emerald-200,
html:not(.dark) .text-emerald-300 {
  color: #047857 !important;
}

html:not(.dark) .text-red-200,
html:not(.dark) .text-red-300 {
  color: #b91c1c !important;
}

html:not(.dark) .text-amber-200,
html:not(.dark) .text-amber-300 {
  color: #b45309 !important;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: rgb(var(--ink-950));
}
::-webkit-scrollbar-thumb {
  background: rgb(var(--line) / 0.18);
  border-radius: 999px;
  border: 2px solid rgb(var(--ink-950));
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--line) / 0.3);
}

@layer components {
  .container-page {
    @apply mx-auto w-full max-w-6xl px-5 sm:px-8;
  }
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 disabled:opacity-50 disabled:pointer-events-none;
  }
  .btn-primary {
    @apply btn bg-brand-500 text-white hover:bg-brand-400 shadow-glow;
  }
  .btn-ghost {
    @apply btn bg-line/5 text-ink-100 hover:bg-line/10 ring-1 ring-line/10;
  }
  .btn-danger {
    @apply btn bg-red-500/90 text-white hover:bg-red-500;
  }
  .btn-sm {
    @apply px-3 py-1.5 text-xs rounded-lg;
  }
  .card {
    @apply rounded-2xl bg-ink-900/60 ring-1 ring-line/10 backdrop-blur;
  }
  .input {
    @apply w-full rounded-xl bg-ink-900/70 px-4 py-2.5 text-sm text-ink-100 ring-1 ring-line/10 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-400/70 transition;
  }
  .label {
    @apply block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1.5;
  }
  .chip {
    @apply inline-flex items-center rounded-full bg-line/5 px-3 py-1 text-xs font-medium text-ink-300 ring-1 ring-line/10;
  }
  .section-title {
    @apply font-display text-3xl sm:text-4xl font-bold tracking-tight text-heading;
  }
}

.glass-nav {
  background: rgb(var(--nav-bg) / var(--nav-alpha));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.grad-text {
  background: linear-gradient(
    120deg,
    rgb(var(--grad-1)) 0%,
    rgb(var(--grad-2)) 45%,
    rgb(var(--grad-3)) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-grid {
  background-image:
    linear-gradient(rgba(90, 134, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(90, 134, 255, 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
}

.spark {
  background: radial-gradient(circle at 30% 20%, rgba(90, 134, 255, 0.22), transparent 55%),
    radial-gradient(circle at 80% 60%, rgba(167, 139, 255, 0.16), transparent 55%);
}
'@
Write-NoBom 'client/src/index.css' $cssFile

$toastFile = @'
import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconCheck, IconX } from "./Icons";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(
  () => {}
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-card ring-1 backdrop-blur ${
                t.kind === "success"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30"
                  : t.kind === "error"
                  ? "bg-red-50 text-red-800 ring-red-500/25 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/30"
                  : "bg-brand-50 text-brand-800 ring-brand-500/25 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/30"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-white ${
                  t.kind === "error"
                    ? "bg-red-600 dark:bg-red-400/30 dark:text-red-100"
                    : t.kind === "info"
                    ? "bg-brand-600 dark:bg-brand-400/30 dark:text-brand-100"
                    : "bg-emerald-600 dark:bg-emerald-400/30 dark:text-emerald-100"
                }`}
              >
                {t.kind === "error" ? (
                  <IconX className="h-3 w-3" />
                ) : (
                  <IconCheck className="h-3 w-3" />
                )}
              </span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
'@
Write-NoBom 'client/src/components/Toast.tsx' $toastFile

$adminLayout = @'
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../../components/ThemeToggle";
import {
  IconBox,
  IconCard,
  IconCode,
  IconDashboard,
  IconExternal,
  IconInbox,
  IconLogout,
  IconMenu,
  IconSparkle,
  IconUser,
  IconX,
} from "../../components/Icons";

const links = [
  { to: "/admin", label: "Dashboard", icon: <IconDashboard className="h-5 w-5" />, end: true },
  { to: "/admin/projects", label: "Projects", icon: <IconCode className="h-5 w-5" /> },
  { to: "/admin/products", label: "Products", icon: <IconBox className="h-5 w-5" /> },
  { to: "/admin/skills", label: "Skills", icon: <IconSparkle className="h-5 w-5" /> },
  { to: "/admin/payments", label: "Payments", icon: <IconCard className="h-5 w-5" /> },
  { to: "/admin/messages", label: "Messages", icon: <IconInbox className="h-5 w-5" /> },
  { to: "/admin/profile", label: "Profile", icon: <IconUser className="h-5 w-5" /> },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-2 py-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-sm font-bold text-white">
          AM
        </span>
        <div>
          <div className="font-display text-sm font-bold text-heading">Admin</div>
          <div className="text-xs text-ink-500">Content Studio</div>
        </div>
      </Link>

      <nav className="mt-8 flex-1 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-800 ring-1 ring-brand-500/25 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/20"
                  : "text-ink-300 hover:bg-line/5 hover:text-heading"
              }`
            }
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line/5 pt-4">
        <div className="mb-1 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-ink-400">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400 hover:bg-line/5 hover:text-heading"
        >
          <IconExternal className="h-5 w-5" />
          View live site
        </a>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          <IconLogout className="h-5 w-5" />
          Sign out
        </button>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-line/5 px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
            {user?.name?.[0] ?? "A"}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-heading">
              {user?.name}
            </div>
            <div className="truncate text-xs text-ink-500">{user?.email}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line/5 bg-ink-900/40 p-4 lg:block">
        {Sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line/5 bg-ink-950/80 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-display font-bold text-heading">Admin</span>
        <button className="btn-ghost btn-sm !px-2" onClick={() => setOpen(true)}>
          <IconMenu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line/5 bg-ink-900 p-4">
            <button
              className="btn-ghost btn-sm absolute right-3 top-3 !px-2"
              onClick={() => setOpen(false)}
            >
              <IconX className="h-5 w-5" />
            </button>
            {Sidebar}
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl p-4 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
'@
Write-NoBom 'client/src/pages/admin/AdminLayout.tsx' $adminLayout

Write-Host ""
Write-Host 'Done. Next run: git add -A ; git commit -m "Improve light mode contrast" ; git push' -ForegroundColor Cyan
