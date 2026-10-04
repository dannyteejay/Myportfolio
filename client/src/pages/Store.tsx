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
  IconImage,
  IconX,
} from "../components/Icons";
import type { PaymentGateway, PaymentMethods, Product } from "../lib/types";

function productImages(product: Product) {
  const urls = [product.coverImage, ...(product.galleryImages ?? [])].filter(
    (url): url is string => Boolean(url)
  );
  return Array.from(new Set(urls));
}

export default function Store() {
  const { data: products, isLoading } = useProducts();
  const [checkout, setCheckout] = useState<Product | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);

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
            products.map((p, i) => {
              const images = productImages(p);
              const mainImage = images[0];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.08 }}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-ink-900/60 ring-1 ring-line/10 transition-all hover:-translate-y-1 hover:ring-brand-400/40"
                >
                  <button
                    type="button"
                    onClick={() => setPreview(p)}
                    className="relative aspect-[16/10] overflow-hidden text-left"
                  >
                    {mainImage ? (
                      <img
                        src={mainImage}
                        alt={p.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center font-display font-bold text-white">
                        {p.title}
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                      {formatMoney(p.price, p.currency)}
                    </div>
                    {images.length > 1 && (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        <IconImage className="h-3.5 w-3.5" />
                        {images.length} screenshots
                      </div>
                    )}
                  </button>
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
                    {images.length > 1 && (
                      <div className="mt-4 flex gap-2 overflow-hidden">
                        {images.slice(0, 4).map((url, index) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setPreview(p)}
                            className="h-12 flex-1 overflow-hidden rounded-lg bg-line/5 ring-1 ring-line/10 transition hover:ring-brand-400/50"
                            title={`Preview screenshot ${index + 1}`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview(p)}
                        className="btn-ghost justify-center"
                      >
                        <IconImage className="h-4 w-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => setCheckout(p)}
                        className="btn-primary justify-center"
                      >
                        <IconCart className="h-4 w-4" />
                        Buy now
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center text-ink-400">
              No products available yet.
            </div>
          )}
        </div>
      </div>

      {preview && (
        <ProductPreviewModal
          product={preview}
          onClose={() => setPreview(null)}
          onBuy={(product) => {
            setPreview(null);
            setCheckout(product);
          }}
        />
      )}

      {checkout && (
        <CheckoutModal product={checkout} onClose={() => setCheckout(null)} />
      )}
    </div>
  );
}

/* ------------------------------ Product preview ---------------------------- */

function ProductPreviewModal({
  product,
  onClose,
  onBuy,
}: {
  product: Product;
  onClose: () => void;
  onBuy: (product: Product) => void;
}) {
  const images = productImages(product);
  const [active, setActive] = useState(0);
  const current = images[active];

  function showNext() {
    if (images.length < 2) return;
    setActive((active + 1) % images.length);
  }

  function showPrev() {
    if (images.length < 2) return;
    setActive((active - 1 + images.length) % images.length);
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card my-8 w-full max-w-5xl overflow-hidden p-0"
      >
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="bg-ink-950/50 p-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800">
              {current ? (
                <img
                  src={current}
                  alt={`${product.title} screenshot ${active + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center p-8 text-center font-display text-3xl font-bold text-white">
                  {product.title}
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Previous screenshot"
                  >
                    â€¹
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Next screenshot"
                  >
                    â€º
                  </button>
                  <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {active + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setActive(index)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                      active === index
                        ? "ring-brand-400"
                        : "ring-line/10 hover:ring-line/30"
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
                  Product preview
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold text-heading">
                  {product.title}
                </h3>
              </div>
              <button onClick={onClose} className="btn-ghost btn-sm !px-2">
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-300">
              {product.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-line/5 p-4 ring-1 ring-line/10">
              <p className="text-xs uppercase tracking-wide text-ink-500">Price</p>
              <p className="mt-1 font-display text-3xl font-bold text-heading">
                {formatMoney(product.price, product.currency)}
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Secure checkout. Your download becomes available after a
                successful payment.
              </p>
            </div>

            <div className="mt-auto pt-6">
              <button onClick={() => onBuy(product)} className="btn-primary w-full">
                <IconCart className="h-4 w-4" />
                Buy now
              </button>
            </div>
          </div>
        </div>
      </motion.div>
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
  const thumbnail = productImages(product)[0];

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
          {thumbnail && (
            <img
              src={thumbnail}
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
                ? "Processingâ€¦"
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