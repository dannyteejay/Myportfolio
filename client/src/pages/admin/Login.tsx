import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/admin";

  if (user) {
    navigate(from, { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast("Welcome back!");
      navigate(from, { replace: true });
    } catch (e: any) {
      toast(e.message ?? "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute inset-0 spark" />
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white shadow-glow">
            AM
          </span>
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold text-heading">
          Admin sign in
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Manage your portfolio content
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link
                to="/admin/forgot-password"
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <IconArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-ink-400 hover:text-heading"
        >
          ← Back to site
        </Link>
      </motion.div>
    </div>
  );
}
