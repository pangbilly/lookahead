/**
 * PDF text-layer extraction with x-position-aware row reconstruction.
 *
 * Uses `pdfjs-dist` (legacy build) to read the text content of each page,
 * groups text items into rows by y-coordinate (with tolerance), then sorts
 * each row by x.
 *
 * Two serverless-specific workarounds live here:
 *
 * 1. pdfjs-dist's legacy build references DOMMatrix / ImageData / Path2D at
 *    module load time. Vercel's Node lambda doesn't expose those as globals,
 *    which triggers `ReferenceError: DOMMatrix is not defined` at import.
 *    We polyfill enough of the API for the module to evaluate. We don't
 *    render pages (text-extraction only), so the stubs never execute real
 *    matrix math.
 *
 * 2. The pdfjs import is dynamic so merely importing this module (e.g. from
 *    the programme server actions during a project-detail page render)
 *    doesn't pull pdfjs into the route handler's cold-start path.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

function polyfillPdfjsGlobals() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === 'undefined') {
    class DOMMatrixStub {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(init?: number[] | string) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
      translate() {
        return new DOMMatrixStub();
      }
      scale() {
        return new DOMMatrixStub();
      }
      multiply() {
        return new DOMMatrixStub();
      }
      invertSelf() {
        return this;
      }
      transformPoint(p?: { x: number; y: number }) {
        return { x: p?.x ?? 0, y: p?.y ?? 0 };
      }
    }
    g.DOMMatrix = DOMMatrixStub;
  }
  if (typeof g.ImageData === 'undefined') {
    class ImageDataStub {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    g.ImageData = ImageDataStub;
  }
  if (typeof g.Path2D === 'undefined') {
    class Path2DStub {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    g.Path2D = Path2DStub;
  }
}

function resolveWorkerSrc(): string {
  const workerFile = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  return pathToFileURL(workerFile).href;
}

let pdfjsLibPromise: Promise<PdfjsModule> | null = null;
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsLibPromise) {
    polyfillPdfjsGlobals();
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
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

const ROW_Y_TOLERANCE = 2;

export async function extractTextLayer(buffer: Buffer): Promise<{
  pageCount: number;
  pages: ExtractedPage[];
}> {
  const pdfjsLib = await loadPdfjs();
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
