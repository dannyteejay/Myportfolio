import { useState } from "react";
import { motion } from "framer-motion";
import { useProfile, useSendMessage } from "../hooks/queries";
import { useToast } from "../components/Toast";
import {
  IconGithub,
  IconLinkedin,
  IconMail,
  IconMapPin,
  IconTwitter,
} from "../components/Icons";

export default function Contact() {
  const { data: profile } = useProfile();
  const send = useSendMessage();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    body: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.body) {
      return toast("Please fill in all required fields", "error");
    }
    try {
      await send.mutateAsync(form);
      toast("Message sent! I'll get back to you soon.");
      setForm({ name: "", email: "", subject: "", body: "" });
    } catch (e: any) {
      toast(e.message ?? "Failed to send message", "error");
    }
  }

  const socials = [
    { url: profile?.githubUrl, icon: <IconGithub className="h-5 w-5" />, label: "GitHub" },
    { url: profile?.linkedinUrl, icon: <IconLinkedin className="h-5 w-5" />, label: "LinkedIn" },
    { url: profile?.twitterUrl, icon: <IconTwitter className="h-5 w-5" />, label: "Twitter" },
  ].filter((s) => s.url);

  return (
    <div className="pt-32 pb-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
            Get in touch
          </p>
          <h1 className="section-title mt-2 !text-4xl sm:!text-5xl">
            Let's build something great
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">
            Have a project, a role, or just want to say hi? Drop me a message and
            I'll respond within a day or two.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="card space-y-4 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input
                  className="input"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Project inquiry"
                />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea
                  className="input min-h-[140px] resize-y"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Tell me about your project…"
                />
              </div>
              <button
                type="submit"
                disabled={send.isPending}
                className="btn-primary w-full sm:w-auto"
              >
                {send.isPending ? "Sending…" : "Send message"}
              </button>
            </form>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-heading">
                Contact details
              </h3>
              <div className="mt-4 space-y-3">
                {profile?.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-3 text-sm text-ink-300 hover:text-heading"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                      <IconMail className="h-4 w-4" />
                    </span>
                    {profile.email}
                  </a>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-3 text-sm text-ink-300">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                      <IconMapPin className="h-4 w-4" />
                    </span>
                    {profile.location}
                  </div>
                )}
              </div>
            </div>

            {socials.length > 0 && (
              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-heading">
                  Follow along
                </h3>
                <div className="mt-4 flex gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.url!}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost !px-3"
                      aria-label={s.label}
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="card overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-6">
              <h3 className="font-display text-lg font-bold text-white">
                Currently available
              </h3>
              <p className="mt-2 text-sm text-brand-100">
                Taking on new freelance and contract projects for this quarter.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
