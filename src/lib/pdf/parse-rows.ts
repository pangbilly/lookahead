/**
 * Turn raw extracted pages into normalised rows per the detected tool.
 *
 * Strategy:
 *   1. Find the header row — the first row whose cells match 3+ of the
 *      tool's canonical column names.
 *   2. Record the x-position of each matched header cell. The rightmost
 *      matched header's x is treated as the right edge of the data table;
 *      everything further right (Gantt bars, year axis) is clipped.
 *   3. For every subsequent row, clip to x <= tableRightEdge, then map
 *      each remaining cell to the nearest header column by x-distance.
 *   4. Rows that don't produce at least one non-empty cell are skipped.
 *
 * This makes the parser robust against the common Gantt-export layout
 * where the left panel (the table) sits alongside a wide Gantt chart on
 * the right. Bar labels, year axis, and Gantt legend all ignored.
 */
import type { ExtractedRow } from '@/db/schema';
import type { Cell, ExtractedPage, Row } from './extract-text-layer';
import type { DetectedTool } from './patterns';
import { TOOL_COLUMNS } from './patterns';

type HeaderMatch = {
  columns: string[];
  columnXs: number[];
  rightEdge: number;
  pageNumber: number;
  rowIndex: number;
};

export type ParseResult = {
  columns: string[];
  rows: ExtractedRow[];
  headerPage: number | null;
  totalRowsSeen: number;
};

const RIGHT_EDGE_PADDING = 50; // PDF units past the last header x to keep

export function parseRows(pages: ExtractedPage[], tool: DetectedTool): ParseResult {
  // Fallback to generic dump for unknown tools — at least the user sees raw text.
  if (tool === 'other') {
    return fallbackRawRows(pages);
  }

  const canonicalColumns = TOOL_COLUMNS[tool];
  const headerMatch = findHeaderRow(pages, canonicalColumns);
  if (!headerMatch) {
    return fallbackRawRows(pages);
  }

  const { columns, columnXs, rightEdge, pageNumber, rowIndex } = headerMatch;
  const rows: ExtractedRow[] = [];
  let totalRowsSeen = 0;

  for (const page of pages) {
    for (let i = 0; i < page.rows.length; i++) {
      if (page.pageNumber === pageNumber && i === rowIndex) continue;
      const row = page.rows[i];
      if (row.cells.length === 0) continue;
      if (isHeaderRepeat(row, canonicalColumns)) continue;

      const mapped = mapRowToColumns(row, columns, columnXs, rightEdge);
      if (mapped && hasAnyValue(mapped)) {
        splitMergedDurationStart(mapped, tool);
        rows.push(mapped);
        totalRowsSeen++;
      }
    }
  }

  return { columns, rows, headerPage: pageNumber, totalRowsSeen };
}

/**
 * Find the row whose cells match the canonical column names for this tool.
 * A cell is considered a match if its lowercased text starts with the
 * column name (lowercased). The matched cells' x-positions anchor the
 * column layout for the rest of the table.
 */
function findHeaderRow(pages: ExtractedPage[], canonical: string[]): HeaderMatch | null {
  const lcCanonical = canonical.map((c) => c.toLowerCase());
  for (const page of pages) {
    const scanLimit = page.pageNumber === 1 ? 40 : 10;
    for (let i = 0; i < Math.min(page.rows.length, scanLimit); i++) {
      const row = page.rows[i];
      const match = matchHeaderCells(row, canonical, lcCanonical);
      if (match && match.columns.length >= 3) {
        return { ...match, pageNumber: page.pageNumber, rowIndex: i };
      }
    }
  }
  return null;
}

function matchHeaderCells(
  row: Row,
  canonical: string[],
  lcCanonical: string[],
): Omit<HeaderMatch, 'pageNumber' | 'rowIndex'> | null {
  // For each canonical column, scan the cells from the current cursor onward.
  // For each start position, try spans 1..4 cells and accept if the joined
  // lowercased text either equals the needle or starts with "<needle> ".
  //
  // For multi-word needles (e.g. "Remaining Duration", "Total Float") the
  // PDF may render the two words on stacked y-lines, so the header row only
  // contains the first word. Fall back to matching just that first word as
  // a standalone cell — acceptable risk for the known canonical vocabulary.
  const columns: string[] = [];
  const columnXs: number[] = [];
  let cursor = 0;

  for (let idx = 0; idx < canonical.length; idx++) {
    const needle = lcCanonical[idx];
    const firstWord = needle.split(' ')[0];
    const isMultiWord = needle.includes(' ');

    let matched = false;
    for (let start = cursor; start < row.cells.length && !matched; start++) {
      const maxSpan = Math.min(4, row.cells.length - start);
      for (let span = 1; span <= maxSpan; span++) {
        const joined = row.cells
          .slice(start, start + span)
          .map((c) => c.text.toLowerCase())
          .join(' ');
        if (joined === needle || joined.startsWith(needle + ' ')) {
          columns.push(canonical[idx]);
          columnXs.push(row.cells[start].x);
          cursor = start + span;
          matched = true;
          break;
        }
      }
      if (matched) break;

      if (isMultiWord) {
        const cellText = row.cells[start].text.toLowerCase();
        if (cellText === firstWord || cellText.startsWith(firstWord + ' ')) {
          columns.push(canonical[idx]);
          columnXs.push(row.cells[start].x);
          cursor = start + 1;
          matched = true;
        }
      }
    }
    // Unmatched column: cursor stays put; next canonical column gets a chance
    // from the same position.
  }

  if (columns.length < 3) return null;

  const lastX = columnXs[columnXs.length - 1];
  const rightEdge = lastX + RIGHT_EDGE_PADDING;
  return { columns, columnXs, rightEdge };
}

function isHeaderRepeat(row: Row, canonical: string[]): boolean {
  const text = row.cells.map((c) => c.text).join(' ').toLowerCase();
  const hits = canonical.reduce(
    (acc, n) => acc + (text.includes(n.toLowerCase()) ? 1 : 0),
    0,
  );
  return hits >= 3;
}

function mapRowToColumns(
  row: Row,
  columns: string[],
  columnXs: number[],
  rightEdge: number,
): ExtractedRow | null {
  // Clip off the Gantt zone.
  const leftCells = row.cells.filter((c) => c.x <= rightEdge);
  if (leftCells.length === 0) return null;

  // For each cell, assign it to the column whose x is <= cell.x and closest.
  const buckets: Cell[][] = columns.map(() => []);
  for (const cell of leftCells) {
    const colIndex = pickColumnIndex(cell.x, columnXs);
    buckets[colIndex].push(cell);
  }

  const record: ExtractedRow = {};
  for (let i = 0; i < columns.length; i++) {
    const joined = buckets[i]
      .map((c) => c.text)
      .join(' ')
      .trim();
    record[columns[i]] = joined || null;
  }
  return record;
}

function pickColumnIndex(x: number, columnXs: number[]): number {
  // Bucket by midpoint between adjacent header xs. Data cells inside a
  // column are typically left- or centre-aligned and can sit slightly to
  // the left of the header's detected x (especially dates under a
  // right-aligned header). Pure "last x <= cell.x" would push those cells
  // back into the previous column. The midpoint boundary is symmetric.
  if (x < (columnXs[0] + columnXs[1]) / 2) return 0;
  for (let i = 1; i < columnXs.length - 1; i++) {
    const leftMid = (columnXs[i - 1] + columnXs[i]) / 2;
    const rightMid = (columnXs[i] + columnXs[i + 1]) / 2;
    if (x >= leftMid && x < rightMid) return i;
  }
  return columnXs.length - 1;
}

/**
 * Some P6/MSP exports render `<duration> <start-date>` as a single text item
 * (adjacent characters with no gap wide enough for pdfjs to split). The
 * merged string can end up in either the duration column or — for summary
 * rows where the content sits further right — the Start column.
 *
 * P6 date annotations preserved in the stored value:
 *   'A'  = actual (date has already happened)
 *   '*'  = constraint (user-imposed, not calculated from logic)
 * These are meaningful in Phase 2 (lookahead generation cares whether a
 * date is actual vs planned vs constrained). We strip them only for
 * display in the preview table.
 */
function splitMergedDurationStart(record: ExtractedRow, tool: DetectedTool) {
  const durationCol = tool === 'primavera_p6' ? 'Remaining Duration' : 'Duration';

  const p6DateRE = /(\d{1,2}-[A-Za-z]{3}-\d{2,4}(?:\s*[A*]+)?)\s*$/;
  const mspDateRE = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/;
  const dateRE = tool === 'primavera_p6' ? p6DateRE : mspDateRE;

  // Case 1: duration column ends with a date — peel date off into Start.
  const durVal = record[durationCol];
  if (durVal) {
    const m = durVal.match(dateRE);
    if (m) {
      const trailing = m[1].trim();
      const remaining = durVal.slice(0, durVal.length - m[0].length).trim();
      if (remaining.length > 0) {
        record[durationCol] = remaining;
        if (!record['Start']?.trim()) record['Start'] = trailing;
      }
    }
  }

  // Case 2: Start column starts with a standalone number (duration) followed
  // by a date. Happens on summary rows where both fields got bucketed into
  // Start because their combined x fell within Start's midpoint window.
  const startVal = record['Start'];
  if (startVal) {
    const leadingNumRE = /^(\d+(?:\s*\w+)?)\s+(\d{1,2}[-/][A-Za-z0-9]{1,3}[-/]\d{2,4}(?:\s*[A*]+)?)\s*$/;
    const m = startVal.match(leadingNumRE);
    if (m) {
      const duration = m[1].trim();
      const date = m[2].trim();
      if (!record[durationCol]?.trim()) record[durationCol] = duration;
      record['Start'] = date;
    }
  }
}

function hasAnyValue(row: ExtractedRow): boolean {
  for (const key of Object.keys(row)) {
    if (row[key] && row[key]!.trim().length > 0) return true;
  }
  return false;
}

function fallbackRawRows(pages: ExtractedPage[]): ParseResult {
  const rows: ExtractedRow[] = [];
  for (const page of pages) {
    for (const row of page.rows) {
      if (row.cells.length === 0) continue;
      rows.push({ _raw: row.cells.map((c) => c.text).join(' | ') });
    }
  }
  return { columns: ['_raw'], rows, headerPage: null, totalRowsSeen: rows.length };
}
