import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectForUser } from '@/actions/project';
import { requireUser } from '@/lib/auth-helpers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);
  return { title: project ? `${project.name} — Lookahead` : 'Project — Lookahead' };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project || project.organizationSlug !== orgSlug) notFound();

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
        <span className="text-[color:var(--foreground-strong)]">{project.name}</span>
      </nav>

      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-4xl">
            {project.name}
          </h1>
          {project.client && (
            <p className="mt-3 text-sm text-[color:var(--foreground)]/70">
              Client: <span className="text-[color:var(--foreground-strong)]">{project.client}</span>
            </p>
          )}
          {(project.startDate || project.endDate) && (
            <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
              {project.startDate ?? '—'} → {project.endDate ?? '—'}
            </p>
          )}
        </div>
      </div>

      {project.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Description
          </h2>
          <p className="mt-3 text-sm text-[color:var(--foreground)]/80 whitespace-pre-line">
            {project.description}
          </p>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Programme
        </h2>
        <div className="mt-6 border border-[color:var(--border)]/40 p-10">
          <p className="text-sm text-[color:var(--foreground)]/80">
            Programme upload arrives in PR 5a. Once uploaded, we&apos;ll extract
            the activities and let you confirm them before generating a lookahead.
          </p>
        </div>
      </section>
    </main>
  );
}
