import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { uploadFile, uploadProductFile } from "../../hooks/queries";
import { useToast } from "../Toast";
import { IconUpload, IconX, IconTrash } from "../Icons";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-heading sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`card my-8 w-full ${wide ? "max-w-2xl" : "max-w-lg"} p-6`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-heading">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-6 text-center"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/15 text-red-300">
          <IconTrash className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold text-heading">{title}</h3>
        <p className="mt-2 text-sm text-ink-400">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn-danger flex-1"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
      toast("Image uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className="relative overflow-hidden rounded-xl ring-1 ring-line/10">
          <img src={value} alt="" className="aspect-[16/9] w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger btn-sm absolute right-2 top-2 !px-2"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploadingâ€¦" : "Click to upload image"}
          </span>
          <span className="text-xs text-ink-500">PNG, JPG, WebP, SVG up to 8MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2">
        <input
          className="input text-xs"
          placeholder="â€¦or paste an image URL"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    </div>
  );
}

export function GalleryImagesUpload({
  value,
  onChange,
}: {
  value: string[] | null | undefined;
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const toast = useToast();
  const images = value ?? [];

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file));
      }
      onChange([...images, ...uploaded]);
      toast(uploaded.length === 1 ? "Gallery image uploaded" : "Gallery images uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (images.includes(url)) {
      toast("That image is already in the gallery", "info");
      setUrlInput("");
      return;
    }
    onChange([...images, url]);
    setUrlInput("");
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploadingâ€¦" : "Upload gallery images"}
          </span>
          <span className="text-xs text-ink-500">Select multiple screenshots</span>
        </button>
        <div className="rounded-xl bg-line/5 p-3 ring-1 ring-line/10">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Paste image URL
          </label>
          <div className="flex gap-2">
            <input
              className="input text-xs"
              placeholder="https://example.com/screenshot.png"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
            />
            <button type="button" onClick={addUrl} className="btn-ghost btn-sm">
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Use this for externally hosted screenshots.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files) handleFiles(files);
          e.target.value = "";
        }}
      />

      {images.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="overflow-hidden rounded-xl bg-line/5 ring-1 ring-line/10">
              <div className="relative aspect-[16/9] bg-ink-950/70">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="btn-danger btn-sm absolute right-2 top-2 !px-2"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-ink-400" title={url}>
                  Image {index + 1}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn-ghost btn-sm !px-2 disabled:opacity-40"
                  >
                    â†‘
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    className="btn-ghost btn-sm !px-2 disabled:opacity-40"
                  >
                    â†“
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-line/5 p-3 text-sm text-ink-500 ring-1 ring-line/10">
          No gallery images yet. Add screenshots of the homepage, admin dashboard,
          mobile view, checkout flow, or any feature buyers should see.
        </p>
      )}
    </div>
  );
}

export function FileUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadProductFile(file);
      onChange(url);
      toast("File uploaded");
    } catch (e: any) {
      toast(e.message ?? "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  const fileName = value ? value.split("/").pop() : "";

  return (
    <div>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-line/5 px-3 py-2 ring-1 ring-line/10">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-brand-300 hover:underline"
            title={value}
          >
            {fileName || "Attached file"}
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger btn-sm !px-2"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line/10 bg-line/5 py-6 text-ink-400 transition-colors hover:border-brand-400/40 hover:text-brand-300"
        >
          <IconUpload className="h-6 w-6" />
          <span className="text-sm font-medium">
            {uploading ? "Uploadingâ€¦" : "Click to upload product file"}
          </span>
          <span className="text-xs text-ink-500">ZIP, PDF, etc. up to 50MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2">
        <input
          className="input text-xs"
          placeholder="â€¦or paste a direct download URL"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    </div>
  );
}

export function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink-950/70 p-2 ring-1 ring-line/10">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-200"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="text-brand-300 hover:text-heading"
            >
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add tag + Enter"
          className="flex-1 bg-transparent px-2 py-1 text-sm text-heading outline-none placeholder:text-ink-500"
        />
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-brand-500" : "bg-line/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-ink-200">{label}</span>
    </button>
  );
}