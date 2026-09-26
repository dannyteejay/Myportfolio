import { useEffect, useState } from "react";
import {
  useOrders,
  usePaymentSettings,
  useSavePaymentSettings,
  useUpdateOrderStatus,
  useDeleteOrder,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import { formatMoney, timeAgo } from "../../lib/format";
import {
  ConfirmDialog,
  Field,
  PageHeader,
  Toggle,
} from "../../components/admin/ui";
import {
  IconBank,
  IconCard,
  IconCheck,
  IconCrypto,
  IconTrash,
  IconX,
} from "../../components/Icons";
import type { OrderStatus, PaymentSettings } from "../../lib/types";

const gatewayIcon = (g: string) =>
  g === "crypto" ? (
    <IconCrypto className="h-4 w-4" />
  ) : g === "bank" ? (
    <IconBank className="h-4 w-4" />
  ) : (
    <IconCard className="h-4 w-4" />
  );

const statusStyle: Record<OrderStatus, string> = {
  paid: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  failed: "bg-red-500/15 text-red-300",
  cancelled: "bg-line/5 text-ink-400",
};

export default function AdminPayments() {
  const { data: settings } = usePaymentSettings();
  const saveSettings = useSavePaymentSettings();
  const { data: orders } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const delOrder = useDeleteOrder();
  const toast = useToast();

  const [form, setForm] = useState<Partial<PaymentSettings>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "settings">("orders");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  function set<K extends keyof PaymentSettings>(k: K, v: PaymentSettings[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSaveSettings() {
    try {
      await saveSettings.mutateAsync(form);
      toast("Payment settings saved");
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  const revenue = (orders ?? [])
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.amount, 0);
  const pendingCount = (orders ?? []).filter(
    (o) => o.status === "pending"
  ).length;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Manage gateways, bank details and customer orders."
      />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-ink-400">Revenue (paid)</div>
          <div className="mt-1 font-display text-2xl font-bold text-heading">
            {formatMoney(revenue, orders?.[0]?.currency ?? "NGN")}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink-400">Total orders</div>
          <div className="mt-1 font-display text-2xl font-bold text-heading">
            {orders?.length ?? 0}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink-400">Pending</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-300">
            {pendingCount}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["orders", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-all ${
              tab === t
                ? "bg-brand-500 text-white shadow-glow"
                : "bg-line/5 text-ink-300 ring-1 ring-line/10 hover:bg-line/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <div className="grid gap-3">
          {(orders ?? []).map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center gap-4 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-line/5 text-ink-300">
                {gatewayIcon(o.gateway)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-heading">
                    {o.productTitle}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[o.status]}`}
                  >
                    {o.status}
                  </span>
                </div>
                <p className="truncate text-sm text-ink-400">
                  {o.email} · {o.gateway} · {o.reference}
                </p>
                <p className="text-xs text-ink-600">{timeAgo(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-heading">
                  {formatMoney(o.amount, o.currency)}
                </div>
              </div>
              <div className="flex gap-2">
                {o.status !== "paid" && (
                  <button
                    onClick={() =>
                      updateStatus.mutate(
                        { id: o.id, status: "paid" },
                        { onSuccess: () => toast("Marked as paid") }
                      )
                    }
                    className="btn-sm !px-2.5 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    title="Mark as paid"
                  >
                    <IconCheck className="h-4 w-4" />
                  </button>
                )}
                {o.status !== "cancelled" && o.status !== "paid" && (
                  <button
                    onClick={() =>
                      updateStatus.mutate({ id: o.id, status: "cancelled" })
                    }
                    className="btn-ghost btn-sm !px-2.5"
                    title="Cancel"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteId(o.id)}
                  className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(!orders || orders.length === 0) && (
            <div className="card py-16 text-center text-ink-400">
              No orders yet. They'll appear here when customers check out.
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="card p-6">
            <h2 className="font-display font-bold text-heading">
              Enabled gateways
            </h2>
            <p className="mt-1 text-sm text-ink-400">
              Toggle which methods appear at checkout. Secret API keys live in
              the server's <code className="text-ink-300">.env</code> file.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-line/5 p-4 ring-1 ring-line/10">
                <Toggle
                  checked={!!form.paystackEnabled}
                  onChange={(v) => set("paystackEnabled", v)}
                  label="Paystack (card)"
                />
              </div>
              <div className="rounded-xl bg-line/5 p-4 ring-1 ring-line/10">
                <Toggle
                  checked={!!form.flutterwaveEnabled}
                  onChange={(v) => set("flutterwaveEnabled", v)}
                  label="Flutterwave"
                />
              </div>
              <div className="rounded-xl bg-line/5 p-4 ring-1 ring-line/10">
                <Toggle
                  checked={!!form.cryptoEnabled}
                  onChange={(v) => set("cryptoEnabled", v)}
                  label="Cryptocurrency"
                />
              </div>
              <div className="rounded-xl bg-line/5 p-4 ring-1 ring-line/10">
                <Toggle
                  checked={!!form.bankEnabled}
                  onChange={(v) => set("bankEnabled", v)}
                  label="Bank transfer"
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="font-display font-bold text-heading">
              Bank transfer details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Bank name">
                <input
                  className="input"
                  value={form.bankName ?? ""}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field label="Account name">
                <input
                  className="input"
                  value={form.bankAccountName ?? ""}
                  onChange={(e) => set("bankAccountName", e.target.value)}
                />
              </Field>
              <Field label="Account number">
                <input
                  className="input"
                  value={form.bankAccountNumber ?? ""}
                  onChange={(e) => set("bankAccountNumber", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Instructions to buyer">
              <textarea
                className="input min-h-[80px] resize-y"
                value={form.bankInstructions ?? ""}
                onChange={(e) => set("bankInstructions", e.target.value)}
              />
            </Field>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="font-display font-bold text-heading">Crypto note</h2>
            <Field label="Message shown for crypto payments">
              <textarea
                className="input min-h-[70px] resize-y"
                value={form.cryptoNote ?? ""}
                onChange={(e) => set("cryptoNote", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saveSettings.isPending}
              className="btn-primary"
            >
              {saveSettings.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete order?"
          message="This will permanently remove the order record."
          onConfirm={() => {
            delOrder.mutate(deleteId);
            toast("Order deleted");
          }}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
