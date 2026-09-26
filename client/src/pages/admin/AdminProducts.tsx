import { useState } from "react";
import {
  useDeleteProduct,
  useProducts,
  useSaveProduct,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import { formatMoney } from "../../lib/format";
import {
  ConfirmDialog,
  Field,
  ImageUpload,
  Modal,
  PageHeader,
  TagsInput,
  Toggle,
} from "../../components/admin/ui";
import { IconEdit, IconPlus, IconTrash } from "../../components/Icons";
import type { Product } from "../../lib/types";

type Draft = Partial<Product> & { priceMajor?: number };

const empty: Draft = {
  title: "",
  description: "",
  price: 0,
  priceMajor: 0,
  currency: "NGN",
  coverImage: "",
  fileUrl: "",
  tags: [],
  published: true,
  order: 0,
};

export default function AdminProducts() {
  const { data: products, isLoading } = useProducts(true);
  const save = useSaveProduct();
  const del = useDeleteProduct();
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function startEdit(p: Product) {
    setEditing({ ...p, priceMajor: p.price / 100 });
  }

  async function handleSave() {
    if (!editing?.title || !editing.description) {
      return toast("Title and description are required", "error");
    }
    const { priceMajor, ...rest } = editing;
    const payload = {
      ...rest,
      price: Math.round((priceMajor ?? 0) * 100),
    };
    try {
      await save.mutateAsync(payload);
      toast(editing.id ? "Product updated" : "Product created");
      setEditing(null);
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await del.mutateAsync(id);
      toast("Product deleted");
    } catch (e: any) {
      toast(e.message ?? "Failed to delete", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage digital products and templates sold in your store."
        action={
          <button onClick={() => setEditing({ ...empty })} className="btn-primary">
            <IconPlus className="h-4 w-4" />
            New product
          </button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/5" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {(products ?? []).map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-line/5">
                {p.coverImage && (
                  <img
                    src={p.coverImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-heading">{p.title}</h3>
                <p className="truncate text-sm text-ink-400">{p.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-bold text-brand-200">
                    {formatMoney(p.price, p.currency)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      p.published
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-line/5 text-ink-400"
                    }`}
                  >
                    {p.published ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="btn-ghost btn-sm !px-2.5"
                >
                  <IconEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteId(p.id)}
                  className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(!products || products.length === 0) && (
            <div className="card py-16 text-center text-ink-400">
              No products yet.
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal
          wide
          title={editing.id ? "Edit product" : "New product"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <Field label="Title">
              <input
                className="input"
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className="input min-h-[100px] resize-y"
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price" hint="In major units (e.g. Naira)">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={editing.priceMajor ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, priceMajor: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Currency">
                <select
                  className="input"
                  value={editing.currency}
                  onChange={(e) =>
                    setEditing({ ...editing, currency: e.target.value })
                  }
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GHS">GHS (₵)</option>
                  <option value="KES">KES</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </Field>
            </div>
            <Field label="Cover image">
              <ImageUpload
                value={editing.coverImage}
                onChange={(url) => setEditing({ ...editing, coverImage: url })}
              />
            </Field>
            <Field
              label="Download / file URL"
              hint="Link buyers receive after purchase"
            >
              <input
                className="input"
                value={editing.fileUrl ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, fileUrl: e.target.value })
                }
                placeholder="https://…"
              />
            </Field>
            <Field label="Tags">
              <TagsInput
                value={editing.tags ?? []}
                onChange={(tags) => setEditing({ ...editing, tags })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display order">
                <input
                  type="number"
                  className="input"
                  value={editing.order ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, order: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="flex items-end pb-2.5">
                <Toggle
                  checked={!!editing.published}
                  onChange={(v) => setEditing({ ...editing, published: v })}
                  label="Published"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={save.isPending}
                className="btn-primary"
              >
                {save.isPending ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete product?"
          message="This will permanently remove the product from your store."
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
