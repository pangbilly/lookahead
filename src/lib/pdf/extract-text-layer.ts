/**
 * PDF text-layer extraction with x-position-aware row reconstruction.
 *
 * Uses `pdfjs-dist` (legacy build, Node-compatible) to read the text content
 * of each page. Groups text items into rows by y-coordinate (with tolerance),
 * then sorts each row by x. Each cell preserves its x/width so downstream
 * parsers can clip off Gantt-chart zones and map cells to columns by position.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function resolveWorkerSrc(): string {
  const workerFile = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  return pathToFileURL(workerFile).href;
}

export type Cell = { text: string; x: number; width: number };
export type Row = { y: number; cells: Cell[] };
export type ExtractedPage = {
  pageNumber: number;
  rows: Row[];
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
}> {
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

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];

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

    const yKeys = [...yBuckets.keys()].sort((a, b) => b - a);
    const rows: Row[] = yKeys.map((y) => {
      const bucket = yBuckets.get(y)!;
      bucket.sort((a, b) => a.transform[4] - b.transform[4]);
      const cells: Cell[] = bucket
        .map((i) => ({
          text: i.str.trim(),
          x: i.transform[4],
          width: i.width,
        }))
        .filter((c) => c.text.length > 0);
      return { y, cells };
    });

    pages.push({ pageNumber, rows });
  }

  await doc.destroy();

  return { pageCount: doc.numPages, pages };
}
