import { useState } from "react";
import { motion } from "framer-motion";
import { useProjects } from "../hooks/queries";
import ProjectCard from "../components/ProjectCard";
import { CardSkeleton } from "../components/Loader";

const filters = [
  { id: "all", label: "All work" },
  { id: "software", label: "Software" },
  { id: "webdesign", label: "Web Design" },
];

export default function Work() {
  const [filter, setFilter] = useState("all");
  const { data: projects, isLoading } = useProjects({ category: filter });

  return (
    <div className="pt-32 pb-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
            Portfolio
          </p>
          <h1 className="section-title mt-2 !text-4xl sm:!text-5xl">
            My work & case studies
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">
            A selection of software products and web design projects I've
            designed, built and shipped.
          </p>
        </motion.div>

        <div className="mt-10 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                filter === f.id
                  ? "bg-brand-500 text-white shadow-glow"
                  : "bg-line/5 text-ink-300 ring-1 ring-line/10 hover:bg-line/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          ) : projects && projects.length > 0 ? (
            projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)
          ) : (
            <div className="col-span-full py-20 text-center text-ink-400">
              No projects in this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
