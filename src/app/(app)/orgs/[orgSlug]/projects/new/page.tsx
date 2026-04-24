import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrgBySlug, requireUser } from '@/lib/auth-helpers';
import { CreateProjectForm } from '@/components/project/CreateProjectForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const org = await requireOrgBySlug(orgSlug, user.id);
  return { title: `New project — ${org.name} — Lookahead` };
}

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const org = await requireOrgBySlug(orgSlug, user.id);

  if (org.role !== 'owner' && org.role !== 'pm') {
    notFound();
  }

  return (
    <main className="px-10 py-16">
      <nav className="display-uppercase text-xs text-[color:var(--foreground)]/60">
        <Link href="/dashboard" className="hover:text-[color:var(--foreground-strong)]">
          Dashboard
        </Link>
        <span className="mx-3">/</span>
        <Link
          href={`/orgs/${org.slug}`}
          className="hover:text-[color:var(--foreground-strong)]"
        >
          {org.name}
        </Link>
        <span className="mx-3">/</span>
        <span className="text-[color:var(--foreground-strong)]">New project</span>
      </nav>

      <h1 className="mt-6 display-uppercase text-[color:var(--foreground-strong)] text-4xl">
        New project
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-[color:var(--foreground)]/70">
        A project is the home for a single construction programme. Once created,
        you&apos;ll upload its programme PDF and generate a lookahead.
      </p>

      <div className="mt-10 max-w-xl">
        <CreateProjectForm organizationId={org.id} organizationSlug={org.slug} />
      </div>
    </main>
  );
}
