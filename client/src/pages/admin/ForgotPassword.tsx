import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import ThemeToggle from "../../components/ThemeToggle";
import { IconArrowRight } from "../../components/Icons";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (err: any) {
      toast(err.message ?? "Something went wrong", "error");
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
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm text-ink-400">
          Enter your admin email and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl bg-line/5 p-4 text-center text-sm text-ink-300 ring-1 ring-line/10">
            If an account exists for that email, a reset link is on its way.
            <br />
            Check your inbox (and spam folder). The link is valid for 1 hour.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Sendingâ€¦" : "Send reset link"}
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
