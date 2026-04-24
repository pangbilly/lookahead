'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { commitActivities } from '@/actions/activity';
import { looksLikeNoise } from '@/lib/pdf/normalise';
import type { ExtractedRow } from '@/db/schema';

type Props = {
  programmeId: string;
  columns: string[];
  initialRows: ExtractedRow[];
};

const DATE_COLUMNS = new Set(['Start', 'Finish', 'Baseline Start', 'Baseline Finish']);

function displayCellValue(col: string, raw: string | null | undefined): string {
  if (!raw) return '';
  if (!DATE_COLUMNS.has(col)) return raw;
  return raw.replace(/\s*[A*]+\s*$/, '').trim();
}

export function ReviewGrid({ programmeId, columns, initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ExtractedRow[]>(initialRows);
  const [hiddenFlags, setHiddenFlags] = useState<boolean[]>(() =>
    initialRows.map((r) => looksLikeNoise(r)),
  );
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (!hiddenFlags[i] || showHidden) out.push(i);
    }
    return out;
  }, [rows, hiddenFlags, showHidden]);

  const hiddenCount = hiddenFlags.filter(Boolean).length;
  const committableCount = rows.reduce(
    (acc, _r, i) => (hiddenFlags[i] ? acc : acc + 1),
    0,
  );

  const updateCell = (rowIndex: number, column: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [column]: value };
      return next;
    });
  };

  const toggleRowHidden = (rowIndex: number) => {
    setHiddenFlags((prev) => {
      const next = [...prev];
      next[rowIndex] = !next[rowIndex];
      return next;
    });
  };

  const onCommit = () => {
    setError(null);
    const toCommit = rows.filter((_, i) => !hiddenFlags[i]);
    startTransition(async () => {
      const result = await commitActivities(programmeId, toCommit);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
            Review extraction ({committableCount} to commit, {hiddenCount} hidden as noise)
          </h2>
          <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
            Click a cell to edit. Use the ✕ on the right to hide a row (stacked header
            words, bar labels, calendar fragments). Commit writes the visible rows to
            the activities table — you can uncommit later.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-[color:var(--foreground)]/80">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="accent-[color:var(--accent)]"
            />
            Show hidden rows
          </label>
          <Button
            type="button"
            disabled={isPending || committableCount === 0}
            onClick={onCommit}
            size="lg"
          >
            {isPending
              ? 'Committing…'
              : `Commit ${committableCount} activit${committableCount === 1 ? 'y' : 'ies'}`}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto border border-[color:var(--border)]/40">
        <table className="w-full min-w-[960px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border)]/40 bg-[color:var(--foreground)]/5">
              {columns.map((col, i) => (
                <th
                  key={`${col}-${i}`}
                  className="px-3 py-3 text-left display-uppercase text-[color:var(--foreground)]"
                >
                  {col}
                </th>
              ))}
              <th className="px-3 py-3 text-right display-uppercase text-[color:var(--foreground)] w-16">
                Hide
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleIndexes.map((rowIndex) => {
              const row = rows[rowIndex];
              const isHidden = hiddenFlags[rowIndex];
              return (
                <tr
                  key={rowIndex}
                  className={`border-b border-[color:var(--border)]/20 ${
                    isHidden ? 'opacity-40' : ''
                  }`}
                >
                  {columns.map((col, j) => (
                    <td
                      key={j}
                      className="px-1 py-0 align-top text-[color:var(--foreground)]/90"
                    >
                      <input
                        type="text"
                        value={displayCellValue(col, row[col])}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        className="w-full bg-transparent px-2 py-2 text-xs focus:outline-none focus:bg-[color:var(--accent)]/10"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleRowHidden(rowIndex)}
                      className="display-uppercase text-xs text-[color:var(--foreground)]/60 hover:text-[color:var(--foreground-strong)]"
                      aria-label={isHidden ? 'Unhide row' : 'Hide row'}
                    >
                      {isHidden ? '↺' : '✕'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
