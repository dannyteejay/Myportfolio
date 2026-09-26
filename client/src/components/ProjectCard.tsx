import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Project } from "../lib/types";
import { IconArrowRight, IconCode, IconLayout } from "./Icons";

export default function ProjectCard({
  project,
  index = 0,
}: {
  project: Project;
  index?: number;
}) {
  const isSoftware = project.category === "software";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
    >
      <Link
        to={`/work/${project.slug}`}
        className="group block overflow-hidden rounded-2xl bg-ink-900/60 ring-1 ring-line/10 transition-all duration-300 hover:-translate-y-1 hover:ring-brand-400/40 hover:shadow-glow"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          {project.coverImage ? (
            <img
              src={project.coverImage}
              alt={project.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-brand-800">
              <span className="font-display text-xl font-bold text-white/90">
                {project.title}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {isSoftware ? (
              <IconCode className="h-3.5 w-3.5 text-brand-300" />
            ) : (
              <IconLayout className="h-3.5 w-3.5 text-purple-300" />
            )}
            {isSoftware ? "Software" : "Web Design"}
          </div>
          {project.featured && (
            <div className="absolute right-3 top-3 rounded-full bg-brand-500/90 px-3 py-1 text-xs font-semibold text-white">
              Featured
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="font-display text-lg font-bold text-heading transition-colors group-hover:text-brand-200">
            {project.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-400">
            {project.summary}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.tags.slice(0, 3).map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-300">
            View case study
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
