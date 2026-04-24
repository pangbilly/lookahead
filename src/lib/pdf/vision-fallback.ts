/**
 * Claude vision fallback — not implemented in PR 5a.
 *
 * When pdf.js returns very few rows and the document has >1 page, it's
 * almost certainly a raster PDF (scanned / image-only). The plan is to
 * render page images and ask Claude Sonnet 4.6 to return structured rows.
 *
 * Deferred until we hit a PDF the text-layer parser can't handle. Stub
 * here so the upload action can reference it without crashing the build.
 */
export async function extractViaClaudeVision(): Promise<never> {
  throw new Error(
    'Claude vision fallback is not implemented in PR 5a. This PDF has no ' +
      'usable text layer — open an issue and attach the file so we can wire ' +
      'the vision extractor.',
  );
}
