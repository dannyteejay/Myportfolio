import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useProfile, useProjects, useSkills } from "../hooks/queries";
import ProjectCard from "../components/ProjectCard";
import { CardSkeleton } from "../components/Loader";
import {
  IconArrowRight,
  IconCode,
  IconDownload,
  IconLayout,
  IconSparkle,
} from "../components/Icons";

export default function Home() {
  const { data: profile } = useProfile();
  const { data: projects, isLoading } = useProjects();
  const { data: skills } = useSkills();

  const featured = (projects ?? []).filter((p) => p.featured).slice(0, 3);
  const showcase = featured.length ? featured : (projects ?? []).slice(0, 3);

  const stats = [
    { value: `${projects?.length ?? 0}+`, label: "Projects shipped" },
    { value: "6+", label: "Years experience" },
    { value: "30+", label: "Happy clients" },
    { value: "98", label: "Avg. Lighthouse" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-24">
        <div className="absolute inset-0 hero-grid" />
        <div className="absolute inset-0 spark" />
        <div className="container-page relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-line/5 px-4 py-1.5 text-xs font-medium text-ink-300 ring-1 ring-line/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Available for new projects
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-heading sm:text-6xl">
              {profile?.title ? (
                <>
                  {profile.name}
                  <br />
                  <span className="grad-text">{profile.title}</span>
                </>
              ) : (
                <>
                  Building software &{" "}
                  <span className="grad-text">beautiful interfaces</span>
                </>
              )}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-300">
              {profile?.tagline ??
                "I design and build fast, elegant web applications and digital products."}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/work" className="btn-primary">
                View my work
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="btn-ghost">
                Get in touch
              </Link>
              {profile?.resumeUrl && (
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  <IconDownload className="h-4 w-4" />
                  Résumé
                </a>
              )}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {stats.map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <div className="font-display text-2xl font-bold text-heading sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-ink-400">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="container-page py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <IconCode className="h-6 w-6" />,
              title: "Software Engineering",
              body: "Full-stack web apps with React, TypeScript, Node and PostgreSQL — architected to scale and built to last.",
            },
            {
              icon: <IconLayout className="h-6 w-6" />,
              title: "Web & Product Design",
              body: "Design systems, marketing sites and product UI with a sharp eye for detail, motion and accessibility.",
            },
            {
              icon: <IconSparkle className="h-6 w-6" />,
              title: "Digital Products",
              body: "Ready-to-ship templates, UI kits and starter projects that help teams move faster from day one.",
            },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card group p-6 transition-colors hover:ring-brand-400/30"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                {s.icon}
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-heading">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured work */}
      <section className="container-page py-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
              Selected work
            </p>
            <h2 className="section-title mt-2">Featured projects</h2>
          </div>
          <Link
            to="/work"
            className="hidden items-center gap-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200 sm:flex"
          >
            All projects
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            : showcase.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
        </div>
      </section>

      {/* Skills */}
      {skills && skills.length > 0 && (
        <section className="container-page py-16">
          <div className="card overflow-hidden">
            <div className="grid gap-10 p-8 md:grid-cols-2 md:p-12">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
                  Toolbox
                </p>
                <h2 className="section-title mt-2">Skills & expertise</h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-400">
                  {profile?.bio ??
                    "A blend of engineering rigor and design craft — the full spectrum from database to pixel."}
                </p>
                <Link to="/contact" className="btn-primary mt-6">
                  Let's work together
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-4">
                {skills.slice(0, 6).map((skill, i) => (
                  <div key={skill.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-heading">{skill.name}</span>
                      <span className="text-ink-500">{skill.level}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/5">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${skill.level}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.08 }}
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page pb-24 pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-center sm:p-16">
          <div className="absolute inset-0 hero-grid opacity-40" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Have a project in mind?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">
              Let's build something people will love to use. I'm currently taking
              on new work.
            </p>
            <Link
              to="/contact"
              className="btn mt-8 bg-white text-brand-700 hover:bg-brand-50"
            >
              Start a conversation
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
