import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  listTasksForProject,
  listWindowsForProject,
  type TaskStatus,
} from '@/actions/lookahead';
import { getProjectForUser } from '@/actions/project';
import { LookaheadTable } from '@/components/lookahead/LookaheadTable';
import type { TaskRow } from '@/components/lookahead/TaskList';
import { WindowPickerForm } from '@/components/lookahead/WindowPickerForm';
import { requireUser } from '@/lib/auth-helpers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);
  return {
    title: project
      ? `Lookahead — ${project.name} — Lookahead`
      : 'Lookahead — Lookahead',
  };
}

export default async function LookaheadPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { window: windowParam } = await searchParams;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project || project.organizationSlug !== orgSlug) notFound();

  const windows = await listWindowsForProject(project.id);

  // Resolve active window: URL param wins, else the latest published one.
  // `all` → no window filter (show everything across the project).
  let activeWindowId: string | null = null;
  const showAll = windowParam === 'all';
  if (!showAll) {
    if (windowParam && windows.some((w) => w.id === windowParam)) {
      activeWindowId = windowParam;
    } else if (windows.length > 0) {
      activeWindowId = windows[0].id;
    }
  }
  const activeWindow =
    activeWindowId != null ? windows.find((w) => w.id === activeWindowId) : null;

  const rawTasks = await listTasksForProject(project.id, {
    windowId: activeWindowId ?? undefined,
  });

  const tasks: TaskRow[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    startDate: t.startDate,
    dueDate: t.dueDate,
    activityExternalId: t.activityExternalId,
    activityIsMilestone: (t.activityIsMilestone ?? null) as
      | 'task'
      | 'milestone'
      | 'summary'
      | null,
    activityByOthers: t.activityByOthers,
    blockerNote: t.blockerNote,
  }));

  const pageBase = `/orgs/${project.organizationSlug}/projects/${project.id}/lookahead`;

  return (
    <main className="px-10 py-16">
      <nav className="display-uppercase text-xs text-[color:var(--foreground)]/60">
        <Link href="/dashboard" className="hover:text-[color:var(--foreground-strong)]">
          Dashboard
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={`/orgs/${project.organizationSlug}`}
          className="hover:text-[color:var(--foreground-strong)]"
        >
          {project.organizationName}
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={`/orgs/${project.organizationSlug}/projects/${project.id}`}
          className="hover:text-[color:var(--foreground-strong)]"
        >
          {project.name}
        </Link>
        <span className="mx-3">/</span>
        <span className="text-[color:var(--foreground-strong)]">Lookahead</span>
      </nav>

      <h1 className="mt-6 display-uppercase text-[color:var(--foreground-strong)] text-4xl">
        Lookahead
      </h1>

      <section className="mt-12 max-w-2xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Generate a new window
        </h2>
        <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
          Claude translates each activity in the window into a plain-English
          site task. You&apos;ll be auto-assigned; Phase 1.5 adds multi-user
          assignment.
        </p>
        <div className="mt-6">
          <WindowPickerForm projectId={project.id} />
        </div>
      </section>

      {windows.length > 0 && (
        <section className="mt-16">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Viewing
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {windows.map((w) => {
              const isActive = activeWindowId === w.id;
              return (
                <Link
                  key={w.id}
                  href={`${pageBase}?window=${w.id}`}
                  className={`display-uppercase text-xs px-4 h-10 inline-flex items-center border ${
                    isActive
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                      : 'border-[color:var(--border)]/60 text-[color:var(--foreground)]/80 hover:border-[color:var(--accent)]'
                  }`}
                >
                  {w.windowStart} → {w.windowEnd}
                  <span className="ml-3 text-[color:var(--foreground)]/50">
                    {w.windowWeeks} wk
                  </span>
                </Link>
              );
            })}
            <Link
              href={`${pageBase}?window=all`}
              className={`display-uppercase text-xs px-4 h-10 inline-flex items-center border ${
                showAll
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                  : 'border-[color:var(--border)]/60 text-[color:var(--foreground)]/80 hover:border-[color:var(--accent)]'
              }`}
            >
              All tasks
            </Link>
          </div>
        </section>
      )}

      <section className="mt-16">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          {activeWindow
            ? `Tasks for ${activeWindow.windowStart} → ${activeWindow.windowEnd}`
            : 'Tasks'}
        </h2>
        <LookaheadTable
          tasks={tasks}
          fixedWindow={
            activeWindow
              ? { start: activeWindow.windowStart, end: activeWindow.windowEnd }
              : undefined
          }
        />
      </section>
    </main>
  );
}
