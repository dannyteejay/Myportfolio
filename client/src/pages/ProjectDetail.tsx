import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useProject } from "../hooks/queries";
import { PageLoader } from "../components/Loader";
import {
  IconArrowRight,
  IconCode,
  IconExternal,
  IconGithub,
  IconLayout,
} from "../components/Icons";

export default function ProjectDetail() {
  const { slug } = useParams();
  const { data: project, isLoading, isError } = useProject(slug!);

  if (isLoading) return <div className="pt-32"><PageLoader /></div>;
  if (isError || !project)
    return (
      <div className="container-page pt-40 pb-24 text-center">
        <h1 className="section-title">Project not found</h1>
        <Link to="/work" className="btn-primary mt-6">
          Back to work
        </Link>
      </div>
    );

  const isSoftware = project.category === "software";

  return (
    <article className="pt-32 pb-24">
      <div className="container-page">
        <Link
          to="/work"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-400 hover:text-heading"
        >
          <IconArrowRight className="h-4 w-4 rotate-180" />
          Back to work
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-line/5 px-3 py-1 text-xs font-medium text-ink-200 ring-1 ring-line/10">
              {isSoftware ? (
                <IconCode className="h-3.5 w-3.5 text-brand-300" />
              ) : (
                <IconLayout className="h-3.5 w-3.5 text-purple-300" />
              )}
              {isSoftware ? "Software" : "Web Design"}
            </span>
            {project.featured && (
              <span className="rounded-full bg-brand-500/90 px-3 py-1 text-xs font-semibold text-white">
                Featured
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-heading sm:text-5xl">
            {project.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-300">
            {project.summary}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                <IconExternal className="h-4 w-4" />
                Visit live site
              </a>
            )}
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                <IconGithub className="h-4 w-4" />
                Source code
              </a>
            )}
          </div>
        </motion.div>

        {project.coverImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-10 overflow-hidden rounded-2xl ring-1 ring-line/10"
          >
            <img
              src={project.coverImage}
              alt={project.title}
              className="w-full object-cover"
            />
          </motion.div>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          <div className="prose-invert lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-heading">
              About this project
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-300">
              {project.description.split("\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Technologies
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Category
              </h3>
              <p className="mt-2 text-sm font-medium text-heading">
                {isSoftware ? "Software Engineering" : "Web & Product Design"}
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white">
            Like what you see?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-brand-100">
            I'd love to help bring your next project to life.
          </p>
          <Link
            to="/contact"
            className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50"
          >
            Get in touch
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
