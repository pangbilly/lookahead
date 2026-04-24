'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { organizationMembers, organizations } from '@/db/schema';
import { requireOrgRole, requireUser } from '@/lib/auth-helpers';
import { uniqueOrgSlug } from '@/lib/slug';
import {
  createOrgSchema,
  renameOrgSchema,
  type CreateOrgInput,
  type RenameOrgInput,
} from '@/lib/validations/org';

export type OrgActionResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function createOrg(input: CreateOrgInput): Promise<OrgActionResult> {
  const user = await requireUser();

  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name } = parsed.data;
  const slug = await uniqueOrgSlug(name);

  // neon-http doesn't support multi-statement transactions; use batch() which
  // pipelines both inserts in a single atomic HTTP request. We generate the
  // org id in JS so the membership insert can reference it inside the batch.
  const organizationId = crypto.randomUUID();
  await db.batch([
    db.insert(organizations).values({ id: organizationId, name, slug }),
    db.insert(organizationMembers).values({
      organizationId,
      userId: user.id,
      role: 'owner',
    }),
  ]);

  revalidatePath('/dashboard');
  return { ok: true, slug };
}

export async function renameOrg(
  organizationId: string,
  input: RenameOrgInput,
): Promise<OrgActionResult> {
  const user = await requireUser();
  await requireOrgRole(organizationId, user.id, ['owner']);

  const parsed = renameOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [updated] = await db
    .update(organizations)
    .set({ name: parsed.data.name })
    .where(eq(organizations.id, organizationId))
    .returning({ slug: organizations.slug });

  if (!updated) return { ok: false, error: 'Organisation not found' };

  revalidatePath('/dashboard');
  revalidatePath(`/orgs/${updated.slug}`);
  revalidatePath(`/orgs/${updated.slug}/settings`);
  return { ok: true, slug: updated.slug };
}

/**
 * Lists the caller's organisations (with their role in each).
 */
export async function listMyOrgs() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: organizationMembers.role,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizations.id),
        eq(organizationMembers.userId, user.id),
      ),
    )
    .orderBy(organizations.createdAt);
  return rows;
}
