import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectForUser } from '@/actions/project';
import { requireUser } from '@/lib/auth-helpers';
import { UploadProgrammeForm } from '@/components/programme/UploadProgrammeForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);
  return {
    title: project ? `Upload programme — ${project.name} — Lookahead` : 'Upload — Lookahead',
  };
}

export default async function UploadProgrammePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const user = await requireUser();
  const project = await getProjectForUser(projectId, user.id);

  if (!project || project.organizationSlug !== orgSlug) notFound();
  if (project.role !== 'owner' && project.role !== 'pm') notFound();

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
        <span className="text-[color:var(--foreground-strong)]">Upload programme</span>
      </nav>

      <h1 className="mt-6 display-uppercase text-[color:var(--foreground-strong)] text-4xl">
        Upload programme
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-[color:var(--foreground)]/70">
        We extract activities from the PDF&apos;s text layer and detect whether it
        came from MS Project or Primavera P6. You&apos;ll see the raw output on the
        next screen; PR 5b will add an editable review grid.
      </p>

      <div className="mt-10 max-w-xl">
        <UploadProgrammeForm projectId={project.id} />
      </div>
    </main>
  );
}
