import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizationMembers, organizations } from '@/db/schema';

export type Role = 'owner' | 'pm' | 'member';

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');
  // Assert narrowing for downstream callers.
  return user as { id: string; email?: string | null; name?: string | null };
}

/**
 * Returns the organisation + the caller's membership, or `null` if the caller
 * is not a member (404s should use `notFound()`; actions should return a
 * friendly error).
 */
export async function getOrgBySlugForUser(
  slug: string,
  userId: string,
): Promise<{ id: string; name: string; slug: string; role: Role } | null> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: organizationMembers.role,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizations.id),
        eq(organizationMembers.userId, userId),
      ),
    )
    .where(eq(organizations.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { ...row, role: row.role as Role };
}

/**
 * Server-component use: load an org by slug, 404 if the caller isn't a
 * member (indistinguishable from "doesn't exist" — no enumeration).
 */
export async function requireOrgBySlug(slug: string, userId: string) {
  const org = await getOrgBySlugForUser(slug, userId);
  if (!org) notFound();
  return org;
}

/**
 * Server-action use: throws if the caller does not hold one of the allowed
 * roles in the given org. Returns the role on success.
 */
export async function requireOrgRole(
  organizationId: string,
  userId: string,
  allowed: Role[] = ['owner', 'pm', 'member'],
): Promise<Role> {
  const rows = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  const role = rows[0]?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    throw new Error('Not a member of this organisation');
  }
  return role;
}
