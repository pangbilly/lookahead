import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser, requireOrgBySlug } from '@/lib/auth-helpers';
import { RenameOrgForm } from '@/components/org/RenameOrgForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const org = await requireOrgBySlug(orgSlug, user.id);
  return { title: `Settings — ${org.name} — Lookahead` };
}

export default async function OrgSettingsPage({
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
        <span className="text-[color:var(--foreground-strong)]">Settings</span>
      </nav>

      <h1 className="mt-6 display-uppercase text-[color:var(--foreground-strong)] text-4xl">
        Settings
      </h1>

      <section className="mt-12 max-w-xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          General
        </h2>
        <div className="mt-6 border border-[color:var(--border)]/40 p-8">
          {org.role === 'owner' ? (
            <RenameOrgForm organizationId={org.id} currentName={org.name} />
          ) : (
            <p className="text-sm text-[color:var(--foreground)]/80">
              Only owners can rename this organisation.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12 max-w-xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Invites
        </h2>
        <div className="mt-6 border border-[color:var(--border)]/40 p-8">
          <p className="text-sm text-[color:var(--foreground)]/80">
            Inviting teammates arrives in PR 5.
          </p>
        </div>
      </section>
    </main>
  );
}
