import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      toast("Password updated. Please sign in.");
      navigate("/admin/login", { replace: true });
    } catch (err: any) {
      toast(err.message ?? "Reset failed", "error");
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
          Choose a new password
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Enter a new password for your admin account.
        </p>

        {!token ? (
          <div className="mt-8 rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-300 ring-1 ring-red-500/20">
            This reset link is missing its token. Please request a new link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Updatingâ€¦" : "Update password"}
              {!loading && <IconArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        <Link
          to="/admin/login"
          className="mt-6 block text-center text-sm text-ink-400 hover:text-heading"
        >
          â† Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
