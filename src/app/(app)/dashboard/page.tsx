import Link from 'next/link';
import { listMyOrgs } from '@/actions/org';
import { CreateOrgForm } from '@/components/org/CreateOrgForm';

export const metadata = {
  title: 'Dashboard — Lookahead',
};

export default async function DashboardPage() {
  const orgs = await listMyOrgs();

  return (
    <main className="px-10 py-16">
      <div className="flex items-end justify-between">
        <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-4xl">
          Dashboard
        </h1>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Organisations
        </h2>

        {orgs.length === 0 ? (
          <div className="mt-6 border border-[color:var(--border)]/40 p-10">
            <p className="text-sm text-[color:var(--foreground)]/80">
              You&apos;re not in any organisations yet. Create your first one to start
              adding projects and inviting your team.
            </p>
            <div className="mt-8">
              <CreateOrgForm />
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-[color:var(--border)]/30 border border-[color:var(--border)]/40">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/orgs/${org.slug}`}
                    className="flex items-center justify-between gap-6 px-6 py-5 hover:bg-[color:var(--foreground)]/5"
                  >
                    <div>
                      <p className="text-[color:var(--foreground-strong)] text-base">
                        {org.name}
                      </p>
                      <p className="text-xs text-[color:var(--foreground)]/60">
                        /orgs/{org.slug}
                      </p>
                    </div>
                    <span className="display-uppercase text-xs text-[color:var(--foreground)]/70">
                      {org.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <details className="mt-10">
              <summary className="display-uppercase text-xs text-[color:var(--foreground)]/70 cursor-pointer hover:text-[color:var(--foreground-strong)]">
                Create another organisation
              </summary>
              <div className="mt-6">
                <CreateOrgForm />
              </div>
            </details>
          </>
        )}
      </section>
    </main>
  );
}
