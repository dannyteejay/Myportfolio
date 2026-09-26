import { useState } from "react";
import {
  useDeleteMessage,
  useMarkMessageRead,
  useMessages,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import { timeAgo } from "../../lib/format";
import { ConfirmDialog, PageHeader } from "../../components/admin/ui";
import { IconMail, IconTrash, IconCheck } from "../../components/Icons";
import type { Message } from "../../lib/types";

export default function AdminMessages() {
  const { data: messages, isLoading } = useMessages();
  const markRead = useMarkMessageRead();
  const del = useDeleteMessage();
  const toast = useToast();
  const [active, setActive] = useState<Message | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function open(m: Message) {
    setActive(m);
    if (!m.read) markRead.mutate(m.id);
  }

  const unread = (messages ?? []).filter((m) => !m.read).length;

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle={
          unread > 0
            ? `You have ${unread} unread message${unread > 1 ? "s" : ""}.`
            : "Messages from your contact form."
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/5" />
            ))
          ) : (messages ?? []).length > 0 ? (
            (messages ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => open(m)}
                className={`card w-full p-4 text-left transition-colors hover:ring-brand-400/30 ${
                  active?.id === m.id ? "ring-brand-400/50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-purple-500/15 font-bold text-purple-200">
                    {m.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-heading">
                        {m.name}
                      </span>
                      {!m.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      )}
                    </div>
                    <p className="truncate text-sm text-ink-400">
                      {m.subject || m.body}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-600">
                    {timeAgo(m.createdAt)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="card py-16 text-center text-ink-400">
              No messages yet.
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          {active ? (
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-heading">
                    {active.subject || "(No subject)"}
                  </h3>
                  <p className="mt-1 text-sm text-ink-400">
                    From <span className="text-heading">{active.name}</span> ·{" "}
                    <a
                      href={`mailto:${active.email}`}
                      className="text-brand-300 hover:underline"
                    >
                      {active.email}
                    </a>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {new Date(active.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteId(active.id)}
                  className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 whitespace-pre-wrap rounded-xl bg-line/5 p-4 text-sm leading-relaxed text-ink-200">
                {active.body}
              </div>
              <div className="mt-5 flex gap-3">
                <a
                  href={`mailto:${active.email}?subject=Re: ${encodeURIComponent(
                    active.subject || "Your message"
                  )}`}
                  className="btn-primary"
                >
                  <IconMail className="h-4 w-4" />
                  Reply by email
                </a>
                {!active.read && (
                  <button
                    onClick={() => markRead.mutate(active.id)}
                    className="btn-ghost"
                  >
                    <IconCheck className="h-4 w-4" />
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card grid place-items-center py-20 text-center text-ink-500">
              <IconMail className="mb-3 h-10 w-10 opacity-40" />
              Select a message to read it.
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete message?"
          message="This message will be permanently deleted."
          onConfirm={() => {
            del.mutate(deleteId);
            if (active?.id === deleteId) setActive(null);
            toast("Message deleted");
          }}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
