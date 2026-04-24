'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { organizationMembers, organizations, projects } from '@/db/schema';
import { requireOrgRole, requireUser } from '@/lib/auth-helpers';
import {
  createProjectSchema,
  type CreateProjectInput,
} from '@/lib/validations/project';

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createProject(
  organizationId: string,
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const user = await requireUser();
  await requireOrgRole(organizationId, user.id, ['owner', 'pm']);

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, client, description, startDate, endDate } = parsed.data;

  const [row] = await db
    .insert(projects)
    .values({
      organizationId,
      name,
      client: client ?? null,
      description: description ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    })
    .returning({ id: projects.id });

  const [org] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (org) {
    revalidatePath(`/orgs/${org.slug}`);
    revalidatePath('/dashboard');
  }

  return { ok: true, projectId: row.id };
}

/**
 * Projects inside a given organisation, ordered newest first.
 * Caller must be a member (enforced by the page's `requireOrgBySlug`).
 */
export async function listProjectsInOrg(organizationId: string) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      client: projects.client,
      startDate: projects.startDate,
      endDate: projects.endDate,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt));
}

/**
 * Caller's most recent projects across all their orgs — for dashboard.
 */
export async function listMyRecentProjects(limit = 5) {
  const user = await requireUser();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, projects.organizationId),
        eq(organizationMembers.userId, user.id),
      ),
    )
    .orderBy(desc(projects.createdAt))
    .limit(limit);
}

/**
 * Resolve a project by id, returning `null` if the caller is not a member of
 * the owning org. Used by project detail pages.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      client: projects.client,
      description: projects.description,
      startDate: projects.startDate,
      endDate: projects.endDate,
      createdAt: projects.createdAt,
      organizationId: projects.organizationId,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: organizationMembers.role,
    })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, projects.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .where(eq(projects.id, projectId))
    .limit(1);

  return rows[0] ?? null;
}
