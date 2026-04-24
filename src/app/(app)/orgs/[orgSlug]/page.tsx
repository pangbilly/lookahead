import Link from 'next/link';
import { requireUser, requireOrgBySlug } from '@/lib/auth-helpers';

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
        {(org.role === 'owner' || org.role === 'pm') && (
          <Link
            href={`/orgs/${org.slug}/settings`}
            className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
          >
            Settings
          </Link>
        )}
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Projects
        </h2>
        <div className="mt-6 border border-[color:var(--border)]/40 p-10">
          <p className="text-sm text-[color:var(--foreground)]/80">
            Projects arrive in PR 4. From PR 2 onwards you can sign up, invite
            teammates, and manage the organisation — but you can&apos;t add a project
            just yet.
          </p>
        </div>
      </section>
    </main>
  );
}
