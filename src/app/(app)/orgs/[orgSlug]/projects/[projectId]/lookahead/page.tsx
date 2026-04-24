import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  listTasksForProject,
  listWindowsForProject,
  type TaskStatus,
} from '@/actions/lookahead';
import { getProjectForUser } from '@/actions/project';
import { TaskGantt } from '@/components/lookahead/TaskGantt';
import { TaskList, type TaskRow } from '@/components/lookahead/TaskList';
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
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project || project.organizationSlug !== orgSlug) notFound();

  const [windows, rawTasks] = await Promise.all([
    listWindowsForProject(project.id),
    listTasksForProject(project.id),
  ]);

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
        <section className="mt-16 max-w-2xl">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Published windows
          </h2>
          <ul className="mt-4 divide-y divide-[color:var(--border)]/30 border border-[color:var(--border)]/40">
            {windows.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between px-5 py-3 text-xs"
              >
                <span className="text-[color:var(--foreground-strong)]">
                  {w.windowStart} → {w.windowEnd}
                </span>
                <span className="display-uppercase text-[color:var(--foreground)]/60">
                  {w.windowWeeks} wk · {w.publishedAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaskGantt tasks={tasks} />

      <section className="mt-16">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Tasks
        </h2>
        <div className="mt-6">
          <TaskList tasks={tasks} />
        </div>
      </section>
    </main>
  );
}
