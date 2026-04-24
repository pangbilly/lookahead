import Link from 'next/link';
import { listProjectsInOrg } from '@/actions/project';
import { requireUser, requireOrgBySlug } from '@/lib/auth-helpers';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const org = await requireOrgBySlug(orgSlug, user.id);
  return { title: `${org.name} — Lookahead` };
}

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const org = await requireOrgBySlug(orgSlug, user.id);
  const projectsList = await listProjectsInOrg(org.id);
  const canCreate = org.role === 'owner' || org.role === 'pm';

  return (
    <main className="px-10 py-16">
      <nav className="display-uppercase text-xs text-[color:var(--foreground)]/60">
        <Link href="/dashboard" className="hover:text-[color:var(--foreground-strong)]">
          Dashboard
        </Link>
        <span className="mx-3">/</span>
        <span className="text-[color:var(--foreground-strong)]">{org.name}</span>
      </nav>

      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-4xl">
            {org.name}
          </h1>
          <p className="mt-3 text-xs text-[color:var(--foreground)]/60">
            /orgs/{org.slug} · {org.role}
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/orgs/${org.slug}/settings`}
            className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
          >
            Settings
          </Link>
        )}
      </div>

      <section className="mt-12 max-w-3xl">
        <div className="flex items-center justify-between">
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Projects
          </h2>
          {canCreate && projectsList.length > 0 && (
            <Button asChild size="sm">
              <Link href={`/orgs/${org.slug}/projects/new`}>New project</Link>
            </Button>
          )}
        </div>

        {projectsList.length === 0 ? (
          <div className="mt-6 border border-[color:var(--border)]/40 p-10">
            <p className="text-sm text-[color:var(--foreground)]/80">
              No projects yet.
              {canCreate
                ? ' Create one to start uploading a programme.'
                : ' An owner or PM needs to create the first project.'}
            </p>
            {canCreate && (
              <div className="mt-8">
                <Button asChild size="lg">
                  <Link href={`/orgs/${org.slug}/projects/new`}>Create a project</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--border)]/30 border border-[color:var(--border)]/40">
            {projectsList.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/orgs/${org.slug}/projects/${project.id}`}
                  className="flex items-center justify-between gap-6 px-6 py-5 hover:bg-[color:var(--foreground)]/5"
                >
                  <div>
                    <p className="text-[color:var(--foreground-strong)] text-base">
                      {project.name}
                    </p>
                    {project.client && (
                      <p className="text-xs text-[color:var(--foreground)]/60">
                        {project.client}
                      </p>
                    )}
                  </div>
                  {(project.startDate || project.endDate) && (
                    <span className="display-uppercase text-xs text-[color:var(--foreground)]/60">
                      {project.startDate ?? '—'} → {project.endDate ?? '—'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
