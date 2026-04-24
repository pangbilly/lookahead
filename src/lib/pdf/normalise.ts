/**
 * Helpers to turn the string cells from rawRows into typed activity fields
 * suitable for the `activities` table. Conservative parsers: anything we
 * can't confidently parse stays null and is visible to the user in the
 * review grid before committing.
 */
import type { DetectedTool } from './patterns';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

export type ParsedDate = {
  iso: string | null; // YYYY-MM-DD
  isActual: boolean;
  isConstrained: boolean;
};

export function parseProgrammeDate(raw: string | null | undefined, tool: DetectedTool): ParsedDate {
  if (!raw) return { iso: null, isActual: false, isConstrained: false };
  const trimmed = raw.trim();
  if (!trimmed) return { iso: null, isActual: false, isConstrained: false };

  const isActual = /[Aa]\s*$/.test(trimmed) || /\bA\b/.test(trimmed);
  const isConstrained = trimmed.includes('*');
  const clean = trimmed.replace(/[A\*\s]+$/i, '').trim();

  if (tool === 'primavera_p6') {
    // DD-MMM-YY (e.g. 27-May-25)
    const m = clean.match(/^(\d{1,2})-([A-Za-z]{3,4})-(\d{2,4})$/);
    if (!m) return { iso: null, isActual, isConstrained };
    const day = parseInt(m[1], 10);
    const monthIdx = MONTHS[m[2].toLowerCase()];
    if (monthIdx === undefined) return { iso: null, isActual, isConstrained };
    const year = expandYear(m[3]);
    return {
      iso: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isActual,
      isConstrained,
    };
  }

  // MSP: DD/MM/YY
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return { iso: null, isActual, isConstrained };
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = expandYear(m[3]);
  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    isActual,
    isConstrained,
  };
}

function expandYear(yy: string): number {
  const n = parseInt(yy, 10);
  if (yy.length === 4) return n;
  // 2-digit heuristic: 50+ → 19xx, else 20xx. OK for construction programmes
  // which will land well inside 2000–2099 for the foreseeable future.
  return n >= 50 ? 1900 + n : 2000 + n;
}

/**
 * Parse a duration cell into whole days.
 *   P6:  plain integer (already days), e.g. "30", "1057", "0"
 *   MSP: "5 days", "10 wks", "2 wk", "0 days"
 * Returns null if the value can't be parsed.
 */
export function parseDurationDays(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Plain integer — P6 case.
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // Integer + unit — MSP case.
  const m = trimmed.match(/^(\d+)\s*(days?|d|wks?|w|months?|mons?|m|hrs?|h)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('d')) return n;
  if (unit.startsWith('w')) return n * 5; // working weeks — 5 working days
  if (unit.startsWith('mon') || unit === 'm') return n * 20; // ~4 working weeks
  if (unit.startsWith('h')) return Math.max(1, Math.round(n / 8));
  return null;
}

export function parseInteger(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^-?\d+$/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Activity type inference:
 *   milestone — remaining duration is 0 OR the row has an external id shaped
 *               like *-KM-* / *-MS-* (common P6 milestone prefixes)
 *   summary   — row has no external id but has text content (P6 WBS/summary
 *               bands don't carry activity IDs)
 *   task      — default
 */
export function inferActivityType(
  externalId: string | null,
  remainingDurationDays: number | null,
  hasName: boolean,
): 'task' | 'milestone' | 'summary' {
  if (remainingDurationDays === 0) return 'milestone';
  if (externalId && /(^|-)(KM|MS)-/i.test(externalId)) return 'milestone';
  if (!externalId && hasName) return 'summary';
  return 'task';
}

/**
 * Heuristic: filter rows that are clearly noise (stacked header words like
 * "Duration", calendar labels, single-character tokens). The review grid
 * applies this to hide them by default; a toggle can reveal them if needed.
 */
export function looksLikeNoise(row: Record<string, string | null | undefined>): boolean {
  const values = Object.values(row).map((v) => (v ?? '').trim()).filter(Boolean);
  if (values.length === 0) return true;
  if (values.length === 1) {
    const v = values[0];
    if (v.length <= 3) return true;
    if (/^(duration|remaining|float|total|start|finish|activity|id|name)$/i.test(v)) return true;
    if (/^\d{1,2}\s*\/\s*\d{1,2}$/.test(v)) return true; // 09/07 axis labels
    if (/^[A-Z]\s*[A-Z]$/.test(v)) return true; // "M A" / "F S"
  }
  return false;
}
