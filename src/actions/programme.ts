'use server';

import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { organizations, programmes, projects } from '@/db/schema';
import { requireOrgRole, requireUser } from '@/lib/auth-helpers';
import { uploadProgrammePdf } from '@/lib/blob';
import { extractTextLayer } from '@/lib/pdf/extract-text-layer';
import { parseRows } from '@/lib/pdf/parse-rows';
import { detectSourceTool } from '@/lib/pdf/patterns';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB

export type UploadResult =
  | { ok: true; programmeId: string; orgSlug: string; projectId: string }
  | { ok: false; error: string };

export async function uploadProgramme(
  projectId: string,
  formData: FormData,
): Promise<UploadResult> {
  const user = await requireUser();

  // Resolve project + verify membership + role.
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
  await requireOrgRole(project.organizationId, user.id, ['owner', 'pm']);

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No file received' };
  }
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'Only PDF files are accepted in Phase 1' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'File is larger than 25 MiB' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Cache hit — same bytes already uploaded for this project.
  const [existing] = await db
    .select({ id: programmes.id })
    .from(programmes)
    .where(and(eq(programmes.projectId, projectId), eq(programmes.fileSha256, sha256)))
    .limit(1);
  if (existing) {
    return {
      ok: true,
      programmeId: existing.id,
      orgSlug: project.organizationSlug,
      projectId: project.id,
    };
  }

  const blob = await uploadProgrammePdf(projectId, file.name, buffer);

  // Insert the programme row with status 'extracting' and kick extraction.
  const [row] = await db
    .insert(programmes)
    .values({
      projectId,
      fileName: file.name,
      fileSha256: sha256,
      sourceFileUrl: blob.url,
      sourceFormat: 'pdf',
      status: 'extracting',
      uploadedBy: user.id,
    })
    .returning({ id: programmes.id });

  // Run extraction inline — Phase 1 PDFs are small (2–8 pages). Long-running
  // extraction can be moved to a queue in Phase 2.
  try {
    const { pages } = await extractTextLayer(buffer);
    const tool = detectSourceTool(pages);
    const parsed = parseRows(pages, tool);

    await db
      .update(programmes)
      .set({
        status: 'extracted',
        sourceToolDetected: tool,
        detectedColumns: parsed.columns,
        rawRows: parsed.rows,
        extractedAt: new Date(),
        extractionError: null,
      })
      .where(eq(programmes.id, row.id));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(programmes)
      .set({ status: 'failed', extractionError: message })
      .where(eq(programmes.id, row.id));
    return { ok: false, error: `Extraction failed: ${message}` };
  }

  revalidatePath(`/orgs/${project.organizationSlug}/projects/${projectId}`);

  return {
    ok: true,
    programmeId: row.id,
    orgSlug: project.organizationSlug,
    projectId: project.id,
  };
}

export async function listProgrammesForProject(projectId: string) {
  await requireUser();
  return db
    .select({
      id: programmes.id,
      fileName: programmes.fileName,
      status: programmes.status,
      sourceToolDetected: programmes.sourceToolDetected,
      uploadedAt: programmes.uploadedAt,
    })
    .from(programmes)
    .where(eq(programmes.projectId, projectId))
    .orderBy(desc(programmes.uploadedAt));
}

export async function getProgrammeForUser(programmeId: string, userId: string) {
  const rows = await db
    .select({
      id: programmes.id,
      fileName: programmes.fileName,
      fileSha256: programmes.fileSha256,
      sourceFileUrl: programmes.sourceFileUrl,
      status: programmes.status,
      sourceToolDetected: programmes.sourceToolDetected,
      detectedColumns: programmes.detectedColumns,
      rawRows: programmes.rawRows,
      extractionError: programmes.extractionError,
      uploadedAt: programmes.uploadedAt,
      projectId: programmes.projectId,
      projectName: projects.name,
      organizationSlug: organizations.slug,
    })
    .from(programmes)
    .innerJoin(projects, eq(projects.id, programmes.projectId))
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(programmes.id, programmeId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Verify the caller is a member of the project's org.
  try {
    await requireOrgRole(
      // We already have the orgId via join; but we need a cheap check.
      // Query through projects is simpler than another helper for now.
      (
        await db
          .select({ organizationId: projects.organizationId })
          .from(projects)
          .where(eq(projects.id, row.projectId))
          .limit(1)
      )[0].organizationId,
      userId,
      ['owner', 'pm', 'member'],
    );
  } catch {
    return null;
  }

  return row;
}
