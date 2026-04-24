import { put, del, get } from '@vercel/blob';

export async function uploadProgrammePdf(
  projectId: string,
  fileName: string,
  body: Buffer | Blob,
): Promise<{ url: string; pathname: string }> {
  // Programme PDFs are customer business data — the Vercel Blob store is
  // configured private. Uploads use access: 'private'; download goes
  // through the authenticated /api/programmes/[id]/download route.
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  const pathname = `programmes/${projectId}/${safeName}`;
  const result = await put(pathname, body, {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });
  return { url: result.url, pathname: result.pathname };
}

export async function deleteProgrammePdf(url: string): Promise<void> {
  await del(url);
}

/** Fetches a private blob; caller must gate by auth + membership first. */
export async function getProgrammePdf(url: string) {
  return get(url, { access: 'private' });
}
