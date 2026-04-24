/**
 * Detect which programme-tool exported a PDF by looking for the distinctive
 * column-header row on page 1.
 *
 * Pattern A — MS Project "Gantt Chart"
 *   Headers include: ID, Task Mode, Task Name, Duration, Start, Finish,
 *                    Predecessors, and often By Others, Category 3
 *
 * Pattern B — Primavera P6 "Classic Schedule"
 *   Headers include: Activity ID, Activity Name, Remaining Duration,
 *                    Start, Finish, Total Float
 *   Activity IDs carry project-coded prefixes like "NOS09-KM-1190".
 *
 * We keep detection deliberately forgiving: match keywords case-insensitively
 * anywhere in the first 30 rows.
 */
import type { ExtractedPage } from './extract-text-layer';

export type DetectedTool = 'ms_project' | 'primavera_p6' | 'other';

export function detectSourceTool(pages: ExtractedPage[]): DetectedTool {
  if (pages.length === 0) return 'other';

  const headerText = pages[0].rows
    .slice(0, 30)
    .map((r) => r.join(' '))
    .join(' ')
    .toLowerCase();

  const mspHits = countHits(headerText, [
    'task mode',
    'task name',
    'predecessors',
    'by others',
    'category 3',
  ]);
  const p6Hits = countHits(headerText, [
    'activity id',
    'activity name',
    'remaining duration',
    'total float',
  ]);

  if (p6Hits >= 2) return 'primavera_p6';
  if (mspHits >= 2) return 'ms_project';
  return 'other';
}

function countHits(haystack: string, needles: string[]): number {
  return needles.reduce((acc, n) => acc + (haystack.includes(n) ? 1 : 0), 0);
}
