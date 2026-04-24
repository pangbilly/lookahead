/**
 * Detect which programme-tool exported a PDF + expose the canonical column
 * list for each. Column lists are used by the parser to decide where the
 * left-panel table ends and the Gantt chart begins.
 */
import type { ExtractedPage } from './extract-text-layer';

export type DetectedTool = 'ms_project' | 'primavera_p6' | 'other';

export const TOOL_COLUMNS: Record<Exclude<DetectedTool, 'other'>, string[]> = {
  ms_project: [
    'ID',
    'Task Mode',
    'Task Name',
    'Duration',
    'Start',
    'Finish',
    'Predecessors',
    'By Others',
    'Category 3',
  ],
  primavera_p6: [
    'Activity ID',
    'Activity Name',
    'Remaining Duration',
    'Start',
    'Finish',
    'Total Float',
  ],
};

export function detectSourceTool(pages: ExtractedPage[]): DetectedTool {
  if (pages.length === 0) return 'other';

  // Collect text from rows across the first three pages — the MSP Gantt
  // Export repeats headers at the top of each subsequent page, and the P6
  // header may sit below a project-title banner on page 1.
  const headerText = pages
    .slice(0, 3)
    .flatMap((p) => p.rows.slice(0, 30))
    .map((r) => r.cells.map((c) => c.text).join(' '))
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
