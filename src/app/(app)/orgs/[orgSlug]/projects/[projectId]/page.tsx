import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectForUser } from '@/actions/project';
import { listProgrammesForProject } from '@/actions/programme';
import { requireUser } from '@/lib/auth-helpers';
import { Button } from '@/components/ui/button';

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

const toolLabels: Record<string, string> = {
  ms_project: 'MS Project',
  primavera_p6: 'Primavera P6',
  other: 'Unknown',
};

const statusLabels: Record<string, string> = {
  uploaded: 'Uploaded',
  extracting: 'Extracting…',
  extracted: 'Extracted',
  failed: 'Failed',
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project || project.organizationSlug !== orgSlug) notFound();

  const programmesList = await listProgrammesForProject(project.id);
  const canUpload = project.role === 'owner' || project.role === 'pm';

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
              Client:{' '}
              <span className="text-[color:var(--foreground-strong)]">
                {project.client}
              </span>
            </p>
          )}
          {(project.startDate || project.endDate) && (
            <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
              {project.startDate ?? '—'} → {project.endDate ?? '—'}
            </p>
          )}
        </div>
        <Link
          href={`/orgs/${project.organizationSlug}/projects/${project.id}/lookahead`}
          className="display-uppercase text-xs text-[color:var(--accent)] hover:underline underline-offset-4"
        >
          Lookahead →
        </Link>
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
        <div className="flex items-center justify-between">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Programmes
          </h2>
          {canUpload && programmesList.length > 0 && (
            <Button asChild size="sm">
              <Link
                href={`/orgs/${project.organizationSlug}/projects/${project.id}/upload`}
              >
                Upload
              </Link>
            </Button>
          )}
        </div>

        {programmesList.length === 0 ? (
          <div className="mt-6 border border-[color:var(--border)]/40 p-10">
            <p className="text-sm text-[color:var(--foreground)]/80">
              No programmes uploaded yet.
              {canUpload
                ? ' Upload a PDF exported from MS Project or Primavera P6 to get started.'
                : ' An owner or PM needs to upload the first programme.'}
            </p>
            {canUpload && (
              <div className="mt-8">
                <Button asChild size="lg">
                  <Link
                    href={`/orgs/${project.organizationSlug}/projects/${project.id}/upload`}
                  >
                    Upload programme
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--border)]/30 border border-[color:var(--border)]/40">
            {programmesList.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/orgs/${project.organizationSlug}/projects/${project.id}/programmes/${p.id}`}
                  className="flex items-center justify-between gap-6 px-6 py-5 hover:bg-[color:var(--foreground)]/5"
                >
                  <div>
                    <p className="text-[color:var(--foreground-strong)] text-base break-all">
                      {p.fileName}
                    </p>
                    <p className="text-xs text-[color:var(--foreground)]/60">
                      {toolLabels[p.sourceToolDetected ?? 'other']} ·{' '}
                      {p.uploadedAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <span className="display-uppercase text-xs text-[color:var(--foreground)]/70">
                    {statusLabels[p.status] ?? p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
