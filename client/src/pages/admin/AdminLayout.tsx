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