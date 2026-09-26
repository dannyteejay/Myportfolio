import { useState } from "react";
import {
  useDeleteProject,
  useProjects,
  useSaveProject,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import {
  ConfirmDialog,
  Field,
  ImageUpload,
  Modal,
  PageHeader,
  TagsInput,
  Toggle,
} from "../../components/admin/ui";
import { IconEdit, IconPlus, IconTrash, IconStar } from "../../components/Icons";
import type { Project } from "../../lib/types";

type Draft = Partial<Project>;

const empty: Draft = {
  title: "",
  category: "software",
  summary: "",
  description: "",
  coverImage: "",
  liveUrl: "",
  repoUrl: "",
  tags: [],
  featured: false,
  published: true,
  order: 0,
};

export default function AdminProjects() {
  const { data: projects, isLoading } = useProjects({ admin: true });
  const save = useSaveProject();
  const del = useDeleteProject();
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleSave() {
    if (!editing?.title || !editing.summary || !editing.description) {
      return toast("Title, summary and description are required", "error");
    }
    try {
      await save.mutateAsync(editing);
      toast(editing.id ? "Project updated" : "Project created");
      setEditing(null);
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await del.mutateAsync(id);
      toast("Project deleted");
    } catch (e: any) {
      toast(e.message ?? "Failed to delete", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Add, edit and remove the work shown on your portfolio."
        action={
          <button onClick={() => setEditing({ ...empty })} className="btn-primary">
            <IconPlus className="h-4 w-4" />
            New project
          </button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/5" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {(projects ?? []).map((p) => (
            <div
              key={p.id}
              className="card flex flex-wrap items-center gap-4 p-4"
            >
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
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-heading">{p.title}</h3>
                  {p.featured && (
                    <IconStar className="h-4 w-4 shrink-0 text-amber-400" />
                  )}
                </div>
                <p className="truncate text-sm text-ink-400">{p.summary}</p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="chip">
                    {p.category === "software" ? "Software" : "Web Design"}
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
                  onClick={() => setEditing({ ...p })}
                  className="btn-ghost btn-sm !px-2.5"
                  aria-label="Edit"
                >
                  <IconEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteId(p.id)}
                  className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  aria-label="Delete"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(!projects || projects.length === 0) && (
            <div className="card py-16 text-center text-ink-400">
              No projects yet. Create your first one.
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal
          wide
          title={editing.id ? "Edit project" : "New project"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input
                  className="input"
                  value={editing.title ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  className="input"
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      category: e.target.value as Project["category"],
                    })
                  }
                >
                  <option value="software">Software</option>
                  <option value="webdesign">Web Design</option>
                </select>
              </Field>
            </div>

            <Field label="Summary" hint="Short one-liner shown on cards">
              <input
                className="input"
                value={editing.summary ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, summary: e.target.value })
                }
              />
            </Field>

            <Field label="Description" hint="Full case-study text">
              <textarea
                className="input min-h-[120px] resize-y"
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>

            <Field label="Cover image">
              <ImageUpload
                value={editing.coverImage}
                onChange={(url) => setEditing({ ...editing, coverImage: url })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Live URL">
                <input
                  className="input"
                  value={editing.liveUrl ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, liveUrl: e.target.value })
                  }
                  placeholder="https://…"
                />
              </Field>
              <Field label="Repository URL">
                <input
                  className="input"
                  value={editing.repoUrl ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, repoUrl: e.target.value })
                  }
                  placeholder="https://github.com/…"
                />
              </Field>
            </div>

            <Field label="Tags / Technologies">
              <TagsInput
                value={editing.tags ?? []}
                onChange={(tags) => setEditing({ ...editing, tags })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
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
                  checked={!!editing.featured}
                  onChange={(v) => setEditing({ ...editing, featured: v })}
                  label="Featured"
                />
              </div>
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
                {save.isPending ? "Saving…" : "Save project"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete project?"
          message="This action cannot be undone. The project will be removed from your portfolio."
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
