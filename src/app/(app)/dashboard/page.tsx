import { requireUser } from '@/lib/auth-helpers';

export const metadata = {
  title: 'Dashboard — Lookahead',
};

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="px-10 py-16">
      <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-4xl">
        Dashboard
      </h1>
      <p className="mt-6 max-w-2xl text-sm text-[color:var(--foreground)]/80">
        Signed in as <strong>{user.email}</strong>.
      </p>
      <p className="mt-4 max-w-2xl text-sm text-[color:var(--foreground)]/60">
        Organisations and projects will appear here once PR 3 lands. For now, this
        page confirms that authentication is wired end-to-end.
      </p>
    </main>
  );
}
