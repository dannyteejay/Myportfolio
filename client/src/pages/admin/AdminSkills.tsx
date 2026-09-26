import { useState } from "react";
import {
  useDeleteSkill,
  useSaveSkill,
  useSkills,
} from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import {
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
} from "../../components/admin/ui";
import { IconEdit, IconPlus, IconTrash } from "../../components/Icons";
import type { Skill } from "../../lib/types";

type Draft = Partial<Skill>;
const empty: Draft = { name: "", category: "frontend", level: 80, order: 0 };

export default function AdminSkills() {
  const { data: skills, isLoading } = useSkills();
  const save = useSaveSkill();
  const del = useDeleteSkill();
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleSave() {
    if (!editing?.name) return toast("Name is required", "error");
    try {
      await save.mutateAsync(editing);
      toast(editing.id ? "Skill updated" : "Skill added");
      setEditing(null);
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Skills"
        subtitle="Show off your tools and expertise levels."
        action={
          <button onClick={() => setEditing({ ...empty })} className="btn-primary">
            <IconPlus className="h-4 w-4" />
            New skill
          </button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-line/5" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(skills ?? []).map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-heading">{s.name}</h3>
                  <span className="chip mt-1">{s.category}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing({ ...s })}
                    className="btn-ghost btn-sm !px-2.5"
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(s.id)}
                    className="btn-sm !px-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-ink-500">
                  <span>Proficiency</span>
                  <span>{s.level}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500"
                    style={{ width: `${s.level}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {(!skills || skills.length === 0) && (
            <div className="card col-span-full py-16 text-center text-ink-400">
              No skills yet.
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? "Edit skill" : "New skill"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <Field label="Name">
              <input
                className="input"
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className="input"
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
              >
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="design">Design</option>
                <option value="devops">DevOps</option>
                <option value="general">General</option>
              </select>
            </Field>
            <Field label={`Proficiency: ${editing.level}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={editing.level ?? 80}
                onChange={(e) =>
                  setEditing({ ...editing, level: Number(e.target.value) })
                }
                className="w-full accent-brand-500"
              />
            </Field>
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
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={save.isPending}
                className="btn-primary"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete skill?"
          message="This will remove the skill from your portfolio."
          onConfirm={() => del.mutate(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
