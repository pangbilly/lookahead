'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  activities,
  organizations,
  programmes,
  projects,
  type ExtractedRow,
} from '@/db/schema';
import { requireOrgRole, requireUser } from '@/lib/auth-helpers';
import {
  inferActivityType,
  parseDurationDays,
  parseInteger,
  parseProgrammeDate,
} from '@/lib/pdf/normalise';
import type { DetectedTool } from '@/lib/pdf/patterns';

export type CommitActivitiesResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

const NEON_BATCH_SIZE = 100; // Neon-http batch limit is generous; chunk anyway

export async function commitActivities(
  programmeId: string,
  rows: ExtractedRow[],
): Promise<CommitActivitiesResult> {
  const user = await requireUser();

  const [programme] = await db
    .select({
      id: programmes.id,
      projectId: programmes.projectId,
      organizationId: projects.organizationId,
      organizationSlug: organizations.slug,
      tool: programmes.sourceToolDetected,
      status: programmes.status,
      alreadyCommittedAt: programmes.activitiesCommittedAt,
    })
    .from(programmes)
    .innerJoin(projects, eq(projects.id, programmes.projectId))
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(programmes.id, programmeId))
    .limit(1);

  if (!programme) return { ok: false, error: 'Programme not found' };
  if (programme.alreadyCommittedAt) {
    return { ok: false, error: 'Activities already committed for this programme' };
  }
  if (programme.status !== 'extracted') {
    return { ok: false, error: `Programme status is '${programme.status}', cannot commit` };
  }

  await requireOrgRole(programme.organizationId, user.id, ['owner', 'pm']);

  const tool = (programme.tool ?? 'other') as DetectedTool;
  const records = rows
    .map((row, idx) => mapRowToActivity(programme.id, programme.projectId, row, tool, idx))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (records.length === 0) {
    return { ok: false, error: 'Nothing to commit — all rows were empty after mapping' };
  }

  // Neon-http supports db.batch() but we also chunk to stay well under any
  // implicit size ceiling and to keep the DB transaction scope small.
  for (let i = 0; i < records.length; i += NEON_BATCH_SIZE) {
    const chunk = records.slice(i, i + NEON_BATCH_SIZE);
    await db.insert(activities).values(chunk);
  }

  await db
    .update(programmes)
    .set({ activitiesCommittedAt: new Date() })
    .where(eq(programmes.id, programmeId));

  revalidatePath(
    `/orgs/${programme.organizationSlug}/projects/${programme.projectId}/programmes/${programmeId}`,
  );
  revalidatePath(`/orgs/${programme.organizationSlug}/projects/${programme.projectId}`);

  return { ok: true, inserted: records.length };
}

function mapRowToActivity(
  programmeId: string,
  projectId: string,
  row: ExtractedRow,
  tool: DetectedTool,
  orderIndex: number,
): typeof activities.$inferInsert | null {
  const name = getStringCell(row, tool === 'primavera_p6' ? 'Activity Name' : 'Task Name');
  if (!name || name.trim().length === 0) return null;

  const externalId = getStringCell(row, tool === 'primavera_p6' ? 'Activity ID' : 'ID');
  const durationCell = getStringCell(
    row,
    tool === 'primavera_p6' ? 'Remaining Duration' : 'Duration',
  );
  const start = parseProgrammeDate(getStringCell(row, 'Start'), tool);
  const finish = parseProgrammeDate(getStringCell(row, 'Finish'), tool);
  const remainingDurationDays = parseDurationDays(durationCell);
  const totalFloatDays = parseInteger(getStringCell(row, 'Total Float'));
  const predecessorsRaw = getStringCell(row, 'Predecessors');
  const predecessors = predecessorsRaw
    ? predecessorsRaw
        .split(/[,;]\s*/)
        .map((p) => p.trim())
        .filter(Boolean)
    : null;

  const byOthers =
    /^(yes|true|y|1)$/i.test((getStringCell(row, 'By Others') ?? '').trim()) || null;
  const category3 =
    /^(yes|true|y|1)$/i.test((getStringCell(row, 'Category 3') ?? '').trim()) || null;

  const activityType = inferActivityType(externalId, remainingDurationDays, !!name);

  return {
    programmeId,
    projectId,
    externalId: externalId ?? null,
    wbsPath: null,
    name: name.trim(),
    description: null,
    startDate: start.iso,
    finishDate: finish.iso,
    startIsActual: start.isActual,
    finishIsActual: finish.isActual,
    startIsConstrained: start.isConstrained,
    finishIsConstrained: finish.isConstrained,
    remainingDurationDays,
    totalFloatDays,
    predecessorIds: predecessors,
    resource: null,
    byOthers: byOthers ?? false,
    category3: category3 ?? false,
    activityType,
    rawJson: row,
    orderIndex,
  };
}

function getStringCell(row: ExtractedRow, col: string): string | null {
  const v = row[col];
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

export async function uncommitActivities(programmeId: string) {
  const user = await requireUser();
  const [programme] = await db
    .select({
      id: programmes.id,
      projectId: programmes.projectId,
      organizationId: projects.organizationId,
      organizationSlug: organizations.slug,
    })
    .from(programmes)
    .innerJoin(projects, eq(projects.id, programmes.projectId))
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(programmes.id, programmeId))
    .limit(1);

  if (!programme) return { ok: false as const, error: 'Programme not found' };
  await requireOrgRole(programme.organizationId, user.id, ['owner', 'pm']);

  await db.delete(activities).where(eq(activities.programmeId, programmeId));
  await db
    .update(programmes)
    .set({ activitiesCommittedAt: null })
    .where(eq(programmes.id, programmeId));

  revalidatePath(
    `/orgs/${programme.organizationSlug}/projects/${programme.projectId}/programmes/${programmeId}`,
  );
  return { ok: true as const };
}

export async function getActivityCountForProgramme(programmeId: string): Promise<number> {
  const rows = await db
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.programmeId, programmeId));
  return rows.length;
}
