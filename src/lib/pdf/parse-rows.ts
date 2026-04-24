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
  // Walk cells left-to-right; collect the first occurrence of each canonical
  // column. Multi-word headers (e.g. "Activity Name") may span two cells —
  // concatenate adjacent cells until the prefix matches.
  const columns: string[] = [];
  const columnXs: number[] = [];
  let cursor = 0;
  for (let idx = 0; idx < canonical.length; idx++) {
    const needle = lcCanonical[idx];
    let found = false;
    let combined = '';
    let combinedX = 0;
    let startCursor = cursor;
    for (let c = cursor; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (combined.length === 0) {
        combined = cell.text.toLowerCase();
        combinedX = cell.x;
        startCursor = c;
      } else {
        combined = (combined + ' ' + cell.text).toLowerCase();
      }
      if (combined.startsWith(needle)) {
        columns.push(canonical[idx]);
        columnXs.push(combinedX);
        cursor = c + 1;
        found = true;
        break;
      }
      // Don't let combined strings balloon — cap concatenation at 3 cells.
      if (c - startCursor >= 2) {
        combined = '';
      }
    }
    if (!found) {
      // Skip non-required columns silently; optional ones (By Others, etc.)
      // may not appear on every export.
      continue;
    }
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
  // The cell belongs to the last column whose header x is <= cell x.
  // If the cell sits left of the first column, bucket it into the first.
  let idx = 0;
  for (let i = 0; i < columnXs.length; i++) {
    if (columnXs[i] <= x) idx = i;
    else break;
  }
  return idx;
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
