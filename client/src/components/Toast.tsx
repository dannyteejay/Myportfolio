import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconCheck, IconX } from "./Icons";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(
  () => {}
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-card ring-1 backdrop-blur ${
                t.kind === "success"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30"
                  : t.kind === "error"
                  ? "bg-red-50 text-red-800 ring-red-500/25 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/30"
                  : "bg-brand-50 text-brand-800 ring-brand-500/25 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/30"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-white ${
                  t.kind === "error"
                    ? "bg-red-600 dark:bg-red-400/30 dark:text-red-100"
                    : t.kind === "info"
                    ? "bg-brand-600 dark:bg-brand-400/30 dark:text-brand-100"
                    : "bg-emerald-600 dark:bg-emerald-400/30 dark:text-emerald-100"
                }`}
              >
                {t.kind === "error" ? (
                  <IconX className="h-3 w-3" />
                ) : (
                  <IconCheck className="h-3 w-3" />
                )}
              </span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}