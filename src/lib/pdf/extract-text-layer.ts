/**
 * PDF text-layer extraction with naive column reconstruction.
 *
 * Uses `pdfjs-dist` (legacy build, Node-compatible) to read the text content
 * of each page. The PDFs Lookahead ingests are tabular (MSP or P6 exports);
 * we group text items into rows by y-coordinate, then sort within each row
 * by x-coordinate. This gives us a 2D grid we can hand to a pattern parser.
 *
 * Important: this does NOT parse columns semantically — cells may still need
 * a heuristic pass to fix split strings (e.g. "21-Apr-26" rendered as two
 * adjacent text items). The pattern parsers in `./patterns.ts` handle that.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs-dist dynamically imports its worker module when getDocument is first
// called. Next/Turbopack can't trace that, so we resolve the worker file
// path ourselves and hand pdfjs the absolute file URL up front. Paired with
// serverExternalPackages: ['pdfjs-dist'] in next.config.ts.
function resolveWorkerSrc(): string {
  const workerFile = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  return pathToFileURL(workerFile).href;
}

export type RawRow = string[];
export type ExtractedPage = {
  pageNumber: number;
  rows: RawRow[];
};

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

const ROW_Y_TOLERANCE = 2; // PDF units — items within this distance share a row

export async function extractTextLayer(buffer: Buffer): Promise<{
  pageCount: number;
  pages: ExtractedPage[];
  allText: string;
}> {
  // Configure worker on first call (lazy so we never run this outside a
  // getDocument() call path — e.g. during Next's build-time page-data pass).
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = resolveWorkerSrc();
  }

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const pages: ExtractedPage[] = [];
  const allTextParts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];

    // Bucket items by y (rounded with tolerance).
    const yBuckets = new Map<number, TextItem[]>();
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / ROW_Y_TOLERANCE) * ROW_Y_TOLERANCE;
      let bucket = yBuckets.get(y);
      if (!bucket) {
        bucket = [];
        yBuckets.set(y, bucket);
      }
      bucket.push(item);
    }

    // Sort rows top-to-bottom (PDF y increases upward, so higher y = higher on page).
    const yKeys = [...yBuckets.keys()].sort((a, b) => b - a);
    const rows: RawRow[] = yKeys.map((y) => {
      const bucket = yBuckets.get(y)!;
      bucket.sort((a, b) => a.transform[4] - b.transform[4]);
      return bucket.map((i) => i.str.trim()).filter(Boolean);
    });

    pages.push({ pageNumber, rows });
    allTextParts.push(rows.flat().join(' '));
  }

  await doc.destroy();

  return { pageCount: doc.numPages, pages, allText: allTextParts.join('\n') };
}
