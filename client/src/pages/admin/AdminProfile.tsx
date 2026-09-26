import { useEffect, useState } from "react";
import { useProfile, useSaveProfile } from "../../hooks/queries";
import { useToast } from "../../components/Toast";
import { Field, ImageUpload, PageHeader } from "../../components/admin/ui";
import type { Profile } from "../../lib/types";

export default function AdminProfile() {
  const { data: profile } = useProfile();
  const save = useSaveProfile();
  const toast = useToast();
  const [form, setForm] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  async function handleSave() {
    if (!form.name || !form.title || !form.email) {
      return toast("Name, title and email are required", "error");
    }
    try {
      await save.mutateAsync(form);
      toast("Profile saved");
    } catch (e: any) {
      toast(e.message ?? "Failed to save", "error");
    }
  }

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="This information appears across your public site."
        action={
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="btn-primary"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="font-display font-bold text-heading">Basic details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                className="input"
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Title / Role">
              <input
                className="input"
                value={form.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Tagline" hint="Shown in the hero section">
            <input
              className="input"
              value={form.tagline ?? ""}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </Field>
          <Field
            label="Browser tab title"
            hint="Shown on the browser tab & in search results. Leave blank to use 'Name — Title'."
          >
            <input
              className="input"
              value={form.metaTitle ?? ""}
              onChange={(e) => set("metaTitle", e.target.value)}
              placeholder="e.g. Alex Morgan — Engineer & Designer"
            />
          </Field>
          <Field label="Bio">
            <textarea
              className="input min-h-[120px] resize-y"
              value={form.bio ?? ""}
              onChange={(e) => set("bio", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                className="input"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={form.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-4 p-6">
            <h2 className="font-display font-bold text-heading">Avatar</h2>
            <ImageUpload
              value={form.avatar}
              onChange={(url) => set("avatar", url)}
            />
          </div>
        </div>

        <div className="card space-y-4 p-6 lg:col-span-3">
          <h2 className="font-display font-bold text-heading">Social & links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GitHub URL">
              <input
                className="input"
                value={form.githubUrl ?? ""}
                onChange={(e) => set("githubUrl", e.target.value)}
              />
            </Field>
            <Field label="LinkedIn URL">
              <input
                className="input"
                value={form.linkedinUrl ?? ""}
                onChange={(e) => set("linkedinUrl", e.target.value)}
              />
            </Field>
            <Field label="Twitter URL">
              <input
                className="input"
                value={form.twitterUrl ?? ""}
                onChange={(e) => set("twitterUrl", e.target.value)}
              />
            </Field>
            <Field label="Website URL">
              <input
                className="input"
                value={form.websiteUrl ?? ""}
                onChange={(e) => set("websiteUrl", e.target.value)}
              />
            </Field>
            <Field label="Résumé URL">
              <input
                className="input"
                value={form.resumeUrl ?? ""}
                onChange={(e) => set("resumeUrl", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}