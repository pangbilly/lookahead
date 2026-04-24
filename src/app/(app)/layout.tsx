import { requireUser } from '@/lib/auth-helpers';
import { TopNav } from '@/components/nav/TopNav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
