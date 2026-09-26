import { useState } from "react";
import { motion } from "framer-motion";
import { usePaymentMethods, useProducts } from "../hooks/queries";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";
import { CardSkeleton } from "../components/Loader";
import { useToast } from "../components/Toast";
import {
  IconBank,
  IconCard,
  IconCart,
  IconCopy,
  IconCrypto,
  IconX,
} from "../components/Icons";
import type { PaymentGateway, PaymentMethods, Product } from "../lib/types";

export default function Store() {
  const { data: products, isLoading } = useProducts();
  const [checkout, setCheckout] = useState<Product | null>(null);

  return (
    <div className="pt-32 pb-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
            Digital store
          </p>
          <h1 className="section-title mt-2 !text-4xl sm:!text-5xl">
            Templates & digital products
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">
            Production-ready templates and UI kits to help you ship faster. Pay
            with card, bank transfer or cryptocurrency.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          ) : products && products.length > 0 ? (
            products.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.08 }}
                className="group flex flex-col overflow-hidden rounded-2xl bg-ink-900/60 ring-1 ring-line/10 transition-all hover:-translate-y-1 hover:ring-brand-400/40"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-brand-800 font-display font-bold text-white">
                      {p.title}
                    </div>
                  )}
                  <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                    {formatMoney(p.price, p.currency)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-lg font-bold text-heading">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-400">
                    {p.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setCheckout(p)}
                    className="btn-primary mt-5 w-full"
                  >
                    <IconCart className="h-4 w-4" />
                    Buy now
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-ink-400">
              No products available yet.
            </div>
          )}
        </div>
      </div>

      {checkout && (
        <CheckoutModal product={checkout} onClose={() => setCheckout(null)} />
      )}
    </div>
  );
}

/* ------------------------------ Checkout modal ----------------------------- */

const GATEWAY_META: Record<
  PaymentGateway,
  { label: string; desc: string; icon: JSX.Element }
> = {
  paystack: {
    label: "Card / Paystack",
    desc: "Debit or credit card, USSD, bank",
    icon: <IconCard className="h-5 w-5" />,
  },
  flutterwave: {
    label: "Flutterwave",
    desc: "Card, mobile money, bank transfer",
    icon: <IconCard className="h-5 w-5" />,
  },
  crypto: {
    label: "Cryptocurrency",
    desc: "BTC, ETH, USDT and more",
    icon: <IconCrypto className="h-5 w-5" />,
  },
  bank: {
    label: "Direct bank transfer",
    desc: "Pay to our bank account",
    icon: <IconBank className="h-5 w-5" />,
  },
};

function availableGateways(m: PaymentMethods): PaymentGateway[] {
  const list: PaymentGateway[] = [];
  if (m.paystack.enabled) list.push("paystack");
  if (m.flutterwave.enabled) list.push("flutterwave");
  if (m.crypto.enabled) list.push("crypto");
  if (m.bank.enabled) list.push("bank");
  return list;
}

function CheckoutModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data: methods } = usePaymentMethods();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState<any | null>(null);
  const toast = useToast();

  const gateways = methods ? availableGateways(methods) : [];

  async function handlePay() {
    if (!email) return toast("Please enter your email", "error");
    if (!gateway) return toast("Please choose a payment method", "error");
    setLoading(true);
    try {
      const res = await api<any>(`/payments/${gateway}/initialize`, {
        method: "POST",
        body: { productSlug: product.slug, email, name },
      });

      if (gateway === "bank") {
        setBankInfo({ ...res.bank, reference: res.reference });
        return;
      }

      if (res.configured && res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        toast(
          res.message ??
            "This gateway is in demo mode. Add its API key on the server to go live.",
          "info"
        );
      }
    } catch (e: any) {
      toast(e.message ?? "Checkout failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card my-8 w-full max-w-md p-6"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display text-xl font-bold text-heading">
            {bankInfo ? "Bank transfer" : "Checkout"}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Product summary */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-line/5 p-3 ring-1 ring-line/10">
          {product.coverImage && (
            <img
              src={product.coverImage}
              alt=""
              className="h-14 w-20 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-heading">{product.title}</p>
            <p className="text-sm font-bold text-brand-300">
              {formatMoney(product.price, product.currency)}
            </p>
          </div>
        </div>

        {bankInfo ? (
          <BankInstructions
            bank={bankInfo}
            amount={product.price}
            currency={product.currency}
            onDone={onClose}
          />
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email for receipt *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Payment method</label>
              <div className="grid gap-2">
                {gateways.length === 0 && (
                  <p className="rounded-xl bg-line/5 p-3 text-sm text-ink-400">
                    No payment methods are currently enabled.
                  </p>
                )}
                {gateways.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGateway(g)}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition-all ${
                      gateway === g
                        ? "bg-brand-500/15 ring-brand-400/50"
                        : "bg-line/5 ring-line/10 hover:ring-line/20"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        gateway === g
                          ? "bg-brand-500 text-white"
                          : "bg-line/5 text-ink-300"
                      }`}
                    >
                      {GATEWAY_META[g].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-heading">
                        {GATEWAY_META[g].label}
                      </span>
                      <span className="block text-xs text-ink-400">
                        {GATEWAY_META[g].desc}
                      </span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        gateway === g
                          ? "border-brand-400 bg-brand-400"
                          : "border-line/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className="btn-primary mt-5 w-full"
            >
              {loading
                ? "Processing…"
                : `Pay ${formatMoney(product.price, product.currency)}`}
            </button>
            <p className="mt-3 text-center text-xs text-ink-500">
              Payments are secured by the selected provider.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

function BankInstructions({
  bank,
  amount,
  currency,
  onDone,
}: {
  bank: any;
  amount: number;
  currency: string;
  onDone: () => void;
}) {
  const toast = useToast();
  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    toast("Copied to clipboard");
  }
  const rows = [
    { label: "Bank", value: bank.bankName },
    { label: "Account name", value: bank.bankAccountName },
    { label: "Account number", value: bank.bankAccountNumber },
    { label: "Amount", value: formatMoney(amount, currency) },
    { label: "Reference", value: bank.reference },
  ].filter((r) => r.value);

  return (
    <div className="mt-5">
      <p className="text-sm text-ink-300">
        Transfer the exact amount to the account below, using the reference as
        your narration.
      </p>
      <div className="mt-4 divide-y divide-line/5 rounded-xl bg-line/5 ring-1 ring-line/10">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between p-3">
            <span className="text-xs uppercase tracking-wide text-ink-500">
              {r.label}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-heading">
              {r.value}
              <button
                onClick={() => copy(String(r.value))}
                className="text-ink-400 hover:text-heading"
              >
                <IconCopy className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
      {bank.instructions && (
        <p className="mt-4 rounded-xl bg-brand-500/10 p-3 text-xs leading-relaxed text-brand-100 ring-1 ring-brand-400/20">
          {bank.instructions}
        </p>
      )}
      <button onClick={onDone} className="btn-primary mt-5 w-full">
        I've made the transfer
      </button>
    </div>
  );
}
