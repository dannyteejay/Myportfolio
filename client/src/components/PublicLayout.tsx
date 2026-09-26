import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useProfile } from "../hooks/queries";
import ThemeToggle from "./ThemeToggle";
import {
  IconGithub,
  IconLinkedin,
  IconMail,
  IconMenu,
  IconTwitter,
  IconX,
} from "./Icons";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/work", label: "Work" },
  { to: "/store", label: "Store" },
  { to: "/contact", label: "Contact" },
];

export default function PublicLayout() {
  const { data: profile } = useProfile();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const name = profile?.name ?? "Portfolio";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen bg-ink-950">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-nav border-b border-line/5 py-3" : "py-5"
        }`}
      >
        <div className="container-page flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-sm font-bold text-white shadow-glow">
              {initials || "AM"}
            </span>
            <span className="font-display text-base font-bold text-heading">
              {name}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-heading"
                      : "text-ink-400 hover:text-heading"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <ThemeToggle className="ml-2" />
            <Link to="/contact" className="btn-primary btn-sm ml-1">
              Hire me
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              className="btn-ghost btn-sm !px-2"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="container-page mt-3 md:hidden">
            <div className="card flex flex-col gap-1 p-2">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 text-sm font-medium ${
                      isActive
                        ? "bg-line/5 text-heading"
                        : "text-ink-300"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-line/5 bg-ink-950">
        <div className="container-page grid gap-8 py-14 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-sm font-bold text-white">
                {initials || "AM"}
              </span>
              <span className="font-display text-base font-bold text-heading">
                {name}
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
              {profile?.tagline ??
                "Building fast, elegant software and delightful interfaces."}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Navigate
            </h4>
            <ul className="mt-4 space-y-2.5">
              {nav.map((n) => (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    className="text-sm text-ink-400 transition-colors hover:text-heading"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Connect
            </h4>
            <div className="mt-4 flex gap-2">
              {profile?.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm !px-2.5" aria-label="GitHub">
                  <IconGithub className="h-4 w-4" />
                </a>
              )}
              {profile?.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm !px-2.5" aria-label="LinkedIn">
                  <IconLinkedin className="h-4 w-4" />
                </a>
              )}
              {profile?.twitterUrl && (
                <a href={profile.twitterUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm !px-2.5" aria-label="Twitter">
                  <IconTwitter className="h-4 w-4" />
                </a>
              )}
              {profile?.email && (
                <a href={`mailto:${profile.email}`} className="btn-ghost btn-sm !px-2.5" aria-label="Email">
                  <IconMail className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-line/5">
          {/* --- Admin link removed; replaced with neutral text --- */}
          <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-ink-500 sm:flex-row">
            <p>© {new Date().getFullYear()} {name}. All rights reserved.</p>
            <p>Designed &amp; built with care.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}