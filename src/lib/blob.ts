import { put, del } from '@vercel/blob';

export async function uploadProgrammePdf(
  projectId: string,
  fileName: string,
  body: Buffer | Blob,
): Promise<{ url: string; pathname: string }> {
  // Path shape: programmes/{projectId}/{timestamp}-{fileName}
  // The addRandomSuffix=true below makes pathname unique even for identical
  // filenames — we don't dedupe here because we also hash the file contents
  // and rely on that for the cache key.
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  const pathname = `programmes/${projectId}/${safeName}`;
  const result = await put(pathname, body, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });
  return { url: result.url, pathname: result.pathname };
}

export async function deleteProgrammePdf(url: string): Promise<void> {
  await del(url);
}
