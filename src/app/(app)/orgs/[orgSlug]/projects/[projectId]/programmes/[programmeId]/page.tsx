import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActivityCountForProgramme } from '@/actions/activity';
import { getProgrammeForUser } from '@/actions/programme';
import { ReviewGrid } from '@/components/programme/ReviewGrid';
import { UncommitButton } from '@/components/programme/UncommitButton';
import { requireUser } from '@/lib/auth-helpers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; programmeId: string }>;
}) {
  const { programmeId } = await params;
  const user = await requireUser();
  const programme = await getProgrammeForUser(programmeId, user.id);
  return {
    title: programme ? `${programme.fileName} — Lookahead` : 'Programme — Lookahead',
  };
}

const toolLabels: Record<string, string> = {
  ms_project: 'MS Project',
  primavera_p6: 'Primavera P6',
  other: 'Unknown',
};

export default async function ProgrammeDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; programmeId: string }>;
}) {
  const { orgSlug, projectId, programmeId } = await params;
  const user = await requireUser();
  const programme = await getProgrammeForUser(programmeId, user.id);

  if (
    !programme ||
    programme.organizationSlug !== orgSlug ||
    programme.projectId !== projectId
  ) {
    notFound();
  }

  const columns = programme.detectedColumns ?? [];
  const rawRows = programme.rawRows ?? [];
  const isCommitted = programme.activitiesCommittedAt !== null;
  const activityCount = isCommitted
    ? await getActivityCountForProgramme(programme.id)
    : 0;

  return (
    <main className="px-10 py-16">
      <nav className="display-uppercase text-xs text-[color:var(--foreground)]/60">
        <Link href="/dashboard" className="hover:text-[color:var(--foreground-strong)]">
          Dashboard
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={`/orgs/${programme.organizationSlug}`}
          className="hover:text-[color:var(--foreground-strong)]"
        >
          Org
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={`/orgs/${programme.organizationSlug}/projects/${programme.projectId}`}
          className="hover:text-[color:var(--foreground-strong)]"
        >
          {programme.projectName}
        </Link>
        <span className="mx-3">/</span>
        <span className="text-[color:var(--foreground-strong)]">{programme.fileName}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-3xl break-all">
            {programme.fileName}
          </h1>
          <p className="mt-3 text-xs text-[color:var(--foreground)]/60">
            Status:{' '}
            <span className="text-[color:var(--foreground-strong)]">
              {programme.status}
            </span>
            {' · '}Tool:{' '}
            <span className="text-[color:var(--foreground-strong)]">
              {toolLabels[programme.sourceToolDetected ?? 'other']}
            </span>
            {' · '}Uploaded{' '}
            {programme.uploadedAt.toISOString().slice(0, 19).replace('T', ' ')}
          </p>
        </div>
        <a
          href={`/api/programmes/${programme.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="display-uppercase text-xs text-[color:var(--accent)] hover:underline underline-offset-4"
        >
          Download original →
        </a>
      </div>

      {programme.status === 'failed' && (
        <section className="mt-10 max-w-3xl border border-[color:var(--accent)]/50 p-8">
          <h2 className="display-uppercase text-[color:var(--accent)] text-sm">
            Extraction failed
          </h2>
          <p className="mt-4 text-sm text-[color:var(--foreground)]/80 whitespace-pre-line">
            {programme.extractionError ?? 'Unknown error'}
          </p>
          <p className="mt-6 text-xs text-[color:var(--foreground)]/60">
            Re-upload the same file from the project page to retry extraction.
          </p>
        </section>
      )}

      {(programme.status === 'extracting' || programme.status === 'uploaded') && (
        <section className="mt-10 max-w-3xl border border-[color:var(--border)]/40 p-8">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Extraction pending
          </h2>
          <p className="mt-4 text-sm text-[color:var(--foreground)]/80">
            This programme was uploaded but extraction didn&apos;t complete
            successfully. Re-upload the same file from the project page to retry.
          </p>
          <p className="mt-4 text-xs text-[color:var(--foreground)]/60">
            Status: {programme.status}
          </p>
        </section>
      )}

      {programme.status === 'extracted' && !isCommitted && (
        <>
          {columns.length > 0 && columns[0] !== '_raw' ? (
            <ReviewGrid
              programmeId={programme.id}
              columns={columns}
              initialRows={rawRows}
            />
          ) : (
            <section className="mt-10 max-w-3xl border border-[color:var(--accent)]/50 p-8">
              <h2 className="display-uppercase text-[color:var(--accent)] text-sm">
                Tool not detected
              </h2>
              <p className="mt-4 text-sm text-[color:var(--foreground)]/80">
                The extractor couldn&apos;t identify this as an MS Project or
                Primavera P6 export. Re-upload a different PDF, or wait for the
                Claude-vision fallback in a later phase.
              </p>
              <details className="mt-6">
                <summary className="display-uppercase text-xs text-[color:var(--foreground)]/70 cursor-pointer">
                  Show raw rows
                </summary>
                <ul className="mt-4 max-h-96 overflow-y-auto divide-y divide-[color:var(--border)]/20 border border-[color:var(--border)]/40">
                  {rawRows.slice(0, 200).map((row, i) => (
                    <li
                      key={i}
                      className="px-4 py-2 text-xs text-[color:var(--foreground)]/80"
                    >
                      {row._raw}
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </>
      )}

      {programme.status === 'extracted' && isCommitted && (
        <section className="mt-12 max-w-3xl border border-[color:var(--border)]/40 p-8">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Activities committed
          </h2>
          <p className="mt-4 text-sm text-[color:var(--foreground)]/80">
            <span className="text-[color:var(--foreground-strong)]">{activityCount}</span>{' '}
            activit{activityCount === 1 ? 'y' : 'ies'} committed on{' '}
            {programme.activitiesCommittedAt
              ? programme.activitiesCommittedAt
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : ''}
            . These are now available to the lookahead generator in PR 6.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <UncommitButton programmeId={programme.id} />
            <span className="text-xs text-[color:var(--foreground)]/50">
              Uncommitting removes the activities rows and lets you re-edit.
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
