'use server';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  activities,
  lookaheadWindows,
  organizations,
  projects,
  tasks,
} from '@/db/schema';
import { requireOrgRole, requireUser } from '@/lib/auth-helpers';
import {
  filterOutCompleted,
  selectActivitiesForWindow,
} from '@/lib/lookahead/select-activities';
import { translateActivitiesToTasks } from '@/lib/lookahead/translate-tasks';

export type GenerateLookaheadResult =
  | { ok: true; windowId: string; created: number; windowStart: string; windowEnd: string }
  | { ok: false; error: string };

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function generateLookahead(
  projectId: string,
  input: { windowStart: string; weeks: 2 | 4 },
): Promise<GenerateLookaheadResult> {
  const user = await requireUser();

  const [project] = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
      organizationSlug: organizations.slug,
    })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return { ok: false, error: 'Project not found' };
  await requireOrgRole(project.organizationId, user.id, ['owner', 'pm', 'member']);

  const days = input.weeks * 7 - 1; // inclusive
  const windowEnd = addDays(input.windowStart, days);

  const selected = filterOutCompleted(
    await selectActivitiesForWindow(projectId, input.windowStart, windowEnd),
  );

  if (selected.length === 0) {
    return { ok: false, error: 'No activities fall into that window' };
  }

  // Don't duplicate tasks for activities that already have a task from a
  // prior window. The duplicate-guard is intentionally per-project, not
  // per-window — if Billy already has a task for "Contract Negotiations",
  // another 2-week window overlapping the same activity shouldn't clone it.
  const existingTaskActivityIds = new Set<string>();
  const existing = await db
    .select({ activityId: tasks.activityId })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(
          tasks.activityId,
          selected.map((a) => a.id),
        ),
      ),
    );
  for (const e of existing) {
    if (e.activityId) existingTaskActivityIds.add(e.activityId);
  }

  const toTranslate = selected.filter((a) => !existingTaskActivityIds.has(a.id));
  const translations = await translateActivitiesToTasks(toTranslate);

  const translationMap = new Map(translations.map((t) => [t.activityId, t.taskTitle]));

  const windowId = crypto.randomUUID();
  const taskRows = toTranslate.map((a) => ({
    id: crypto.randomUUID(),
    projectId,
    activityId: a.id,
    lookaheadWindowId: windowId,
    title: translationMap.get(a.id) ?? a.name,
    description: null,
    startDate: a.startDate,
    dueDate: a.finishDate,
    assigneeId: user.id,
    createdBy: user.id,
    status: 'todo' as const,
  }));

  // Sequential inserts — neon-http isn't transactional across statements
  // (we use batch() elsewhere where atomicity matters). If the second insert
  // fails, the cache-guard above (skip activities with existing tasks) makes
  // re-running idempotent.
  await db.insert(lookaheadWindows).values({
    id: windowId,
    projectId,
    windowStart: input.windowStart,
    windowEnd,
    windowWeeks: input.weeks,
    publishedBy: user.id,
  });
  if (taskRows.length > 0) {
    await db.insert(tasks).values(taskRows);
  }

  revalidatePath(
    `/orgs/${project.organizationSlug}/projects/${projectId}/lookahead`,
  );

  return {
    ok: true,
    windowId,
    created: taskRows.length,
    windowStart: input.windowStart,
    windowEnd,
  };
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  blockerNote?: string,
) {
  const user = await requireUser();

  const [row] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      organizationId: projects.organizationId,
      organizationSlug: organizations.slug,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!row) return { ok: false as const, error: 'Task not found' };
  await requireOrgRole(row.organizationId, user.id, ['owner', 'pm', 'member']);

  const update: Partial<typeof tasks.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'done') {
    update.completedAt = new Date();
  } else {
    update.completedAt = null;
  }
  if (status === 'blocked') {
    update.blockerNote = blockerNote?.trim() || null;
  } else {
    update.blockerNote = null;
  }

  await db.update(tasks).set(update).where(eq(tasks.id, taskId));

  revalidatePath(
    `/orgs/${row.organizationSlug}/projects/${row.projectId}/lookahead`,
  );

  return { ok: true as const };
}

export async function listWindowsForProject(projectId: string) {
  await requireUser();
  return db
    .select({
      id: lookaheadWindows.id,
      windowStart: lookaheadWindows.windowStart,
      windowEnd: lookaheadWindows.windowEnd,
      windowWeeks: lookaheadWindows.windowWeeks,
      publishedAt: lookaheadWindows.publishedAt,
    })
    .from(lookaheadWindows)
    .where(eq(lookaheadWindows.projectId, projectId))
    .orderBy(desc(lookaheadWindows.publishedAt));
}

export async function listTasksForProject(projectId: string) {
  await requireUser();
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      activityId: tasks.activityId,
      assigneeId: tasks.assigneeId,
      blockerNote: tasks.blockerNote,
      lookaheadWindowId: tasks.lookaheadWindowId,
      completedAt: tasks.completedAt,
      activityExternalId: activities.externalId,
      activityIsMilestone: activities.activityType,
      activityByOthers: activities.byOthers,
    })
    .from(tasks)
    .leftJoin(activities, eq(activities.id, tasks.activityId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(tasks.startDate);
}
