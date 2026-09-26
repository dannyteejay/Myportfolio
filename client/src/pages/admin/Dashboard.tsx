import { Link } from "react-router-dom";
import {
  useMessages,
  useProducts,
  useProjects,
  useSkills,
} from "../../hooks/queries";
import { useAuth } from "../../hooks/useAuth";
import { timeAgo } from "../../lib/format";
import { PageHeader } from "../../components/admin/ui";
import {
  IconBox,
  IconCode,
  IconInbox,
  IconArrowRight,
  IconSparkle,
} from "../../components/Icons";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects } = useProjects({ admin: true });
  const { data: products } = useProducts(true);
  const { data: skills } = useSkills();
  const { data: messages } = useMessages();

  const unread = (messages ?? []).filter((m) => !m.read).length;

  const stats = [
    {
      label: "Projects",
      value: projects?.length ?? 0,
      to: "/admin/projects",
      icon: <IconCode className="h-5 w-5" />,
      color: "text-brand-300 bg-brand-500/15 ring-brand-400/20",
    },
    {
      label: "Products",
      value: products?.length ?? 0,
      to: "/admin/products",
      icon: <IconBox className="h-5 w-5" />,
      color: "text-purple-300 bg-purple-500/15 ring-purple-400/20",
    },
    {
      label: "Skills",
      value: skills?.length ?? 0,
      to: "/admin/skills",
      icon: <IconSparkle className="h-5 w-5" />,
      color: "text-emerald-300 bg-emerald-500/15 ring-emerald-400/20",
    },
    {
      label: "Unread messages",
      value: unread,
      to: "/admin/messages",
      icon: <IconInbox className="h-5 w-5" />,
      color: "text-amber-300 bg-amber-500/15 ring-amber-400/20",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "Admin"} 👋`}
        subtitle="Here's what's happening with your portfolio."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="card group p-5 transition-all hover:-translate-y-0.5 hover:ring-brand-400/30"
          >
            <div className="flex items-center justify-between">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${s.color}`}
              >
                {s.icon}
              </span>
              <IconArrowRight className="h-4 w-4 text-ink-600 transition-transform group-hover:translate-x-1 group-hover:text-brand-300" />
            </div>
            <div className="mt-4 font-display text-3xl font-bold text-heading">
              {s.value}
            </div>
            <div className="text-sm text-ink-400">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-heading">
              Recent projects
            </h2>
            <Link
              to="/admin/projects"
              className="text-sm font-semibold text-brand-300 hover:text-brand-200"
            >
              Manage
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {(projects ?? []).slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-line/5 p-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                  {p.category === "software" ? (
                    <IconCode className="h-4 w-4" />
                  ) : (
                    <IconBox className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-heading">
                    {p.title}
                  </div>
                  <div className="text-xs text-ink-500">
                    {p.published ? "Published" : "Draft"} · {timeAgo(p.updatedAt)}
                  </div>
                </div>
              </div>
            ))}
            {(!projects || projects.length === 0) && (
              <p className="py-6 text-center text-sm text-ink-500">
                No projects yet.
              </p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-heading">
              Latest messages
            </h2>
            <Link
              to="/admin/messages"
              className="text-sm font-semibold text-brand-300 hover:text-brand-200"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {(messages ?? []).slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl bg-line/5 p-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-500/15 text-sm font-bold text-purple-200">
                  {m.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-heading">
                    {m.name}
                    {!m.read && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-400" />
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-500">
                    {m.subject || m.body}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink-600">
                  {timeAgo(m.createdAt)}
                </span>
              </div>
            ))}
            {(!messages || messages.length === 0) && (
              <p className="py-6 text-center text-sm text-ink-500">
                No messages yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
