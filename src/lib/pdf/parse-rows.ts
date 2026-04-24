/**
 * Turn raw extracted pages into normalised rows per the detected tool.
 *
 * First pass — deliberately lossy. Finds the header row and uses it as the
 * column list, then for each subsequent row with a matching cell count,
 * zips the cells to the headers by index. Rows with unexpected cell counts
 * are emitted as `{ _raw: "col1 | col2 | col3" }` so they still appear in
 * the review grid (PR 5b), where a human can fix alignment or split.
 *
 * Good enough for first-pass inspection and dogfooding. PR 5a is
 * explicitly not the final parser — PR 5b gives the user the tools to fix
 * what this produces, and a Claude-vision fallback path lives in
 * `./vision-fallback.ts` (stubbed for now, implemented when we hit a PDF
 * this parser can't handle).
 */
import type { ExtractedRow } from '@/db/schema';
import type { ExtractedPage } from './extract-text-layer';
import type { DetectedTool } from './patterns';

const MSP_HEADER_KEYWORDS = ['id', 'task name', 'duration', 'start', 'finish'];
const P6_HEADER_KEYWORDS = ['activity id', 'activity name', 'start', 'finish'];

export type ParseResult = {
  columns: string[];
  rows: ExtractedRow[];
  headerPage: number | null;
  totalRowsSeen: number;
};

export function parseRows(pages: ExtractedPage[], tool: DetectedTool): ParseResult {
  const keywords = tool === 'primavera_p6' ? P6_HEADER_KEYWORDS : MSP_HEADER_KEYWORDS;

  const headerMatch = findHeaderRow(pages, keywords);
  if (!headerMatch) {
    // Fall back: emit every page's rows as raw joined text so nothing is lost.
    return fallbackRawRows(pages);
  }

  const { columns, pageNumber, rowIndex } = headerMatch;
  const rows: ExtractedRow[] = [];
  let totalRowsSeen = 0;

  for (const page of pages) {
    for (let i = 0; i < page.rows.length; i++) {
      // Skip the detected header row on its page.
      if (page.pageNumber === pageNumber && i === rowIndex) continue;

      const cells = page.rows[i];
      if (cells.length === 0) continue;
      // Heuristic: repeated headers on every page — skip.
      if (looksLikeHeaderRepeat(cells, keywords)) continue;
      totalRowsSeen++;

      if (cells.length === columns.length) {
        const record: ExtractedRow = {};
        for (let c = 0; c < columns.length; c++) {
          record[columns[c]] = cells[c] ?? null;
        }
        rows.push(record);
      } else {
        rows.push({ _raw: cells.join(' | ') });
      }
    }
  }

  return { columns, rows, headerPage: pageNumber, totalRowsSeen };
}

function findHeaderRow(
  pages: ExtractedPage[],
  keywords: string[],
): { columns: string[]; pageNumber: number; rowIndex: number } | null {
  for (const page of pages) {
    // Only scan the first 40 rows of page 1 and first 10 rows of other pages.
    const scanLimit = page.pageNumber === 1 ? 40 : 10;
    for (let i = 0; i < Math.min(page.rows.length, scanLimit); i++) {
      const row = page.rows[i];
      const rowText = row.join(' ').toLowerCase();
      const hits = keywords.reduce(
        (acc, k) => acc + (rowText.includes(k) ? 1 : 0),
        0,
      );
      if (hits >= 3) {
        return { columns: row, pageNumber: page.pageNumber, rowIndex: i };
      }
    }
  }
  return null;
}

function looksLikeHeaderRepeat(row: string[], keywords: string[]): boolean {
  const text = row.join(' ').toLowerCase();
  const hits = keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
  return hits >= 3;
}

function fallbackRawRows(pages: ExtractedPage[]): ParseResult {
  const rows: ExtractedRow[] = [];
  for (const page of pages) {
    for (const cells of page.rows) {
      if (cells.length === 0) continue;
      rows.push({ _raw: cells.join(' | ') });
    }
  }
  return { columns: ['_raw'], rows, headerPage: null, totalRowsSeen: rows.length };
}
