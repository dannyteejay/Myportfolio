import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { Spinner } from "../components/Loader";
import { IconArrowRight, IconCheck, IconX } from "../components/Icons";

type State = "loading" | "paid" | "pending" | "failed";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const [state, setState] = useState<State>("loading");

  const gateway = params.get("gateway") ?? "";
  // Paystack returns ?reference=, Flutterwave ?transaction_id=&tx_ref=&status=
  const reference =
    params.get("reference") || params.get("tx_ref") || params.get("order_id");
  const transactionId = params.get("transaction_id");
  const cryptoStatus = params.get("status");

  useEffect(() => {
    (async () => {
      // Crypto/bank are confirmed asynchronously (webhook / admin)
      if (gateway === "crypto") {
        setState(cryptoStatus === "success" ? "pending" : "failed");
        return;
      }
      try {
        const q = new URLSearchParams({ gateway });
        if (reference) q.set("reference", reference);
        if (transactionId) q.set("transaction_id", transactionId);
        const res = await api<{ status: string }>(
          `/payments/verify?${q.toString()}`
        );
        if (res.status === "paid") setState("paid");
        else if (res.status === "failed" || res.status === "cancelled")
          setState("failed");
        else setState("pending");
      } catch {
        setState("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = {
    loading: {
      title: "Verifying payment…",
      body: "Please wait while we confirm your transaction.",
    },
    paid: {
      title: "Payment successful! 🎉",
      body: "Thank you for your purchase. A receipt has been sent to your email, and you'll receive your download shortly.",
    },
    pending: {
      title: "Payment pending",
      body: "We've received your order and are awaiting confirmation. You'll get an email as soon as it's confirmed.",
    },
    failed: {
      title: "Payment not completed",
      body: "Your payment didn't go through or was cancelled. You can try again from the store.",
    },
  }[state];

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 p-4">
      <div className="absolute inset-0 hero-grid" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative w-full max-w-md p-8 text-center"
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full">
          {state === "loading" && <Spinner className="h-10 w-10" />}
          {state === "paid" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <IconCheck className="h-8 w-8" />
            </span>
          )}
          {state === "pending" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 text-amber-300 font-display text-2xl font-bold">
              …
            </span>
          )}
          {state === "failed" && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-300">
              <IconX className="h-8 w-8" />
            </span>
          )}
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold text-heading">
          {config.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{config.body}</p>

        {reference && (
          <p className="mt-4 rounded-lg bg-line/5 px-3 py-2 text-xs text-ink-400">
            Reference: <span className="text-ink-200">{reference}</span>
          </p>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/store" className="btn-ghost">
            Back to store
          </Link>
          <Link to="/" className="btn-primary">
            Go home
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
