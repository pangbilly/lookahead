import Link from 'next/link';
import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';

type TopNavProps = {
  user: { email?: string | null; name?: string | null };
};

export function TopNav({ user }: TopNavProps) {
  return (
    <header className="flex items-center justify-between border-b border-[color:var(--border)]/30 px-10 py-6">
      <div className="flex items-center gap-10">
        <Link
          href="/dashboard"
          className="display-uppercase text-[color:var(--foreground-strong)] text-sm"
        >
          Lookahead
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
          >
            Dashboard
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-xs text-[color:var(--foreground)]/70">
          {user.name ?? user.email}
        </span>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" className="display-uppercase">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
