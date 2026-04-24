import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgrammeForUser } from '@/actions/programme';
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

  const rowsPreview = (programme.rawRows ?? []).slice(0, 50);
  const columns = programme.detectedColumns ?? [];

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
          href={programme.sourceFileUrl}
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
        </section>
      )}

      {programme.status === 'extracted' && (
        <>
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
                Extracted rows ({(programme.rawRows ?? []).length} total, showing first {rowsPreview.length})
              </h2>
              <span className="text-xs text-[color:var(--foreground)]/60">
                Raw preview · editable grid arrives in PR 5b
              </span>
            </div>

            {columns.length > 0 && columns[0] !== '_raw' ? (
              <div className="mt-6 overflow-x-auto border border-[color:var(--border)]/40">
                <table className="w-full min-w-[960px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[color:var(--border)]/40 bg-[color:var(--foreground)]/5">
                      {columns.map((col, i) => (
                        <th
                          key={`${col}-${i}`}
                          className="px-3 py-3 text-left display-uppercase text-[color:var(--foreground)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsPreview.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--border)]/20 hover:bg-[color:var(--foreground)]/5"
                      >
                        {columns.map((col, j) => (
                          <td
                            key={j}
                            className="px-3 py-2 align-top text-[color:var(--foreground)]/90"
                          >
                            {row[col] ?? (col === '_raw' ? row._raw : '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-[color:var(--border)]/20 border border-[color:var(--border)]/40">
                {rowsPreview.map((row, i) => (
                  <li key={i} className="px-4 py-2 text-xs text-[color:var(--foreground)]/80">
                    {row._raw}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10 max-w-3xl border border-[color:var(--border)]/40 p-8">
            <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
              Next
            </h2>
            <p className="mt-3 text-sm text-[color:var(--foreground)]/80">
              PR 5b will add an editable review grid so you can fix
              misaligned cells and confirm the activities before committing
              to the database. PR 6 then generates a lookahead.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
