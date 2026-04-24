'use client';

import { useMemo } from 'react';
import type { TaskRow } from './TaskList';

type Props = {
  tasks: TaskRow[];
};

type Granularity = 'day' | 'week' | 'month';

const STATUS_STYLES: Record<
  TaskRow['status'],
  { label: string; fill: string; border: string; text: string }
> = {
  todo: {
    label: 'To do',
    fill: 'transparent',
    border: 'var(--accent)',
    text: 'var(--foreground-strong)',
  },
  in_progress: {
    label: 'In progress',
    fill: 'var(--accent)',
    border: 'var(--accent)',
    text: 'var(--foreground-strong)',
  },
  blocked: {
    label: 'Blocked',
    fill: '#c62828',
    border: '#c62828',
    text: 'var(--foreground-strong)',
  },
  done: {
    label: 'Done',
    fill: 'rgba(128,128,128,0.35)',
    border: 'rgba(128,128,128,0.55)',
    text: 'var(--foreground)',
  },
  cancelled: {
    label: 'Cancelled',
    fill: 'transparent',
    border: 'rgba(128,128,128,0.4)',
    text: 'var(--foreground)',
  },
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function startOfISOWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getUTCDay() + 6) % 7; // 0 = Monday
  copy.setUTCDate(copy.getUTCDate() - dow);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthsBetween(a: Date, b: Date): number {
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth())
  );
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

type Computed = {
  granularity: Granularity;
  origin: Date;
  cols: number;
  colLabels: string[];
  colSubLabels: string[] | null;
  colWidth: number;
  weekendCols: Set<number>; // only populated for 'day' granularity
  todayCol: number | null;
};

function computeTimeline(tasks: TaskRow[]): Computed | null {
  const withDates = tasks.filter((t) => t.startDate || t.dueDate);
  if (withDates.length === 0) return null;

  let min: Date | null = null;
  let max: Date | null = null;
  for (const t of withDates) {
    const s = t.startDate ? parseISODate(t.startDate) : null;
    const f = t.dueDate ? parseISODate(t.dueDate) : null;
    const taskMin = s ?? f;
    const taskMax = f ?? s;
    if (taskMin && (!min || taskMin < min)) min = taskMin;
    if (taskMax && (!max || taskMax > max)) max = taskMax;
  }
  if (!min || !max) return null;

  const totalDays = daysBetween(min, max) + 1;
  let granularity: Granularity = 'day';
  if (totalDays > 365) granularity = 'month';
  else if (totalDays > 60) granularity = 'week';

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (granularity === 'day') {
    const origin = new Date(min);
    origin.setUTCHours(0, 0, 0, 0);
    const cols = totalDays;
    const colLabels: string[] = [];
    const colSubLabels: string[] = [];
    const weekendCols = new Set<number>();
    for (let i = 0; i < cols; i++) {
      const d = addDays(origin, i);
      const dow = (d.getUTCDay() + 6) % 7;
      colLabels.push(WEEKDAYS[dow]);
      colSubLabels.push(String(d.getUTCDate()));
      if (dow >= 5) weekendCols.add(i);
    }
    const todayDiff = daysBetween(origin, today);
    return {
      granularity,
      origin,
      cols,
      colLabels,
      colSubLabels,
      colWidth: 32,
      weekendCols,
      todayCol: todayDiff >= 0 && todayDiff < cols ? todayDiff : null,
    };
  }

  if (granularity === 'week') {
    const origin = startOfISOWeek(min);
    const endWeek = startOfISOWeek(max);
    const cols = Math.floor(daysBetween(origin, endWeek) / 7) + 1;
    const colLabels: string[] = [];
    const colSubLabels: string[] = [];
    for (let i = 0; i < cols; i++) {
      const d = addWeeks(origin, i);
      colLabels.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
      colSubLabels.push('');
    }
    const todayWeek = Math.floor(daysBetween(origin, today) / 7);
    return {
      granularity,
      origin,
      cols,
      colLabels,
      colSubLabels: null,
      colWidth: 60,
      weekendCols: new Set(),
      todayCol: todayWeek >= 0 && todayWeek < cols ? todayWeek : null,
    };
  }

  // month
  const origin = startOfMonth(min);
  const endMonth = startOfMonth(max);
  const cols = monthsBetween(origin, endMonth) + 1;
  const colLabels: string[] = [];
  for (let i = 0; i < cols; i++) {
    const d = addMonths(origin, i);
    colLabels.push(
      d.getUTCMonth() === 0
        ? `${MONTHS[0]} '${String(d.getUTCFullYear()).slice(2)}`
        : MONTHS[d.getUTCMonth()],
    );
  }
  const todayMonth = monthsBetween(origin, today);
  return {
    granularity,
    origin,
    cols,
    colLabels,
    colSubLabels: null,
    colWidth: 72,
    weekendCols: new Set(),
    todayCol: todayMonth >= 0 && todayMonth < cols ? todayMonth : null,
  };
}

function taskBarOffsets(
  task: TaskRow,
  computed: Computed,
): { startCol: number; span: number } | null {
  const s = task.startDate ? parseISODate(task.startDate) : null;
  const f = task.dueDate ? parseISODate(task.dueDate) : null;
  if (!s && !f) return null;
  const start = s ?? f!;
  const finish = f ?? s!;

  let startCol: number;
  let endCol: number;
  if (computed.granularity === 'day') {
    startCol = daysBetween(computed.origin, start);
    endCol = daysBetween(computed.origin, finish);
  } else if (computed.granularity === 'week') {
    startCol = Math.floor(daysBetween(computed.origin, start) / 7);
    endCol = Math.floor(daysBetween(computed.origin, finish) / 7);
  } else {
    startCol = monthsBetween(computed.origin, start);
    endCol = monthsBetween(computed.origin, finish);
  }

  // Clamp to grid
  startCol = Math.max(0, Math.min(startCol, computed.cols - 1));
  endCol = Math.max(0, Math.min(endCol, computed.cols - 1));
  return { startCol, span: Math.max(1, endCol - startCol + 1) };
}

export function TaskGantt({ tasks }: Props) {
  const computed = useMemo(() => computeTimeline(tasks), [tasks]);
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const av = a.startDate ?? a.dueDate ?? '9999-12-31';
        const bv = b.startDate ?? b.dueDate ?? '9999-12-31';
        return av.localeCompare(bv);
      }),
    [tasks],
  );

  if (!computed || sorted.length === 0) return null;

  const totalWidth = computed.cols * computed.colWidth;
  const leftPanelWidth = 320;

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between">
        <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
          Timeline
        </h2>
        <div className="flex items-center gap-4 text-[10px] text-[color:var(--foreground)]/70 display-uppercase">
          <LegendSwatch label="To do" status="todo" />
          <LegendSwatch label="In progress" status="in_progress" />
          <LegendSwatch label="Blocked" status="blocked" />
          <LegendSwatch label="Done" status="done" />
          <span className="text-[color:var(--foreground)]/50">
            Granularity: {computed.granularity}
          </span>
        </div>
      </div>

      <div className="mt-4 border border-[color:var(--border)]/40 overflow-x-auto">
        <div
          className="relative"
          style={{ width: `${leftPanelWidth + totalWidth}px` }}
        >
          {/* Header row */}
          <div
            className="flex sticky top-0 z-10 bg-[color:var(--background)]/95 backdrop-blur-sm border-b border-[color:var(--border)]/40"
            style={{ height: computed.colSubLabels ? 48 : 32 }}
          >
            <div
              className="shrink-0 border-r border-[color:var(--border)]/40 flex items-center px-4"
              style={{ width: leftPanelWidth }}
            >
              <span className="display-uppercase text-[10px] text-[color:var(--foreground)]/60">
                Task
              </span>
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {computed.colLabels.map((label, i) => {
                const isWeekend = computed.weekendCols.has(i);
                const isToday = computed.todayCol === i;
                return (
                  <div
                    key={i}
                    className="border-r border-[color:var(--border)]/15 text-center flex flex-col justify-center"
                    style={{
                      width: computed.colWidth,
                      backgroundColor: isWeekend
                        ? 'rgba(128,128,128,0.06)'
                        : undefined,
                    }}
                  >
                    <span
                      className={`display-uppercase text-[10px] ${
                        isToday
                          ? 'text-[color:var(--accent)]'
                          : 'text-[color:var(--foreground)]/60'
                      }`}
                    >
                      {label}
                    </span>
                    {computed.colSubLabels && (
                      <span
                        className={`text-[11px] ${
                          isToday
                            ? 'text-[color:var(--accent)] font-bold'
                            : 'text-[color:var(--foreground-strong)]'
                        }`}
                      >
                        {computed.colSubLabels[i]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {sorted.map((task) => {
            const offsets = taskBarOffsets(task, computed);
            const style = STATUS_STYLES[task.status];
            return (
              <div
                key={task.id}
                className="flex border-b border-[color:var(--border)]/15 hover:bg-[color:var(--foreground)]/3"
                style={{ height: 36 }}
              >
                <div
                  className="shrink-0 border-r border-[color:var(--border)]/40 flex items-center gap-2 px-4"
                  style={{ width: leftPanelWidth }}
                >
                  <span
                    className="flex-1 min-w-0 truncate text-xs text-[color:var(--foreground-strong)]"
                    title={task.title}
                  >
                    {task.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-[color:var(--foreground)]/50">
                    {task.activityIsMilestone === 'milestone' ? '◆' : ''}
                  </span>
                </div>

                {/* Track */}
                <div
                  className="relative"
                  style={{ width: totalWidth, height: 36 }}
                >
                  {/* Weekend stripes (day granularity) */}
                  {computed.granularity === 'day' && (
                    <div className="absolute inset-0 flex pointer-events-none">
                      {Array.from({ length: computed.cols }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: computed.colWidth,
                            backgroundColor: computed.weekendCols.has(i)
                              ? 'rgba(128,128,128,0.05)'
                              : undefined,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Today line */}
                  {computed.todayCol !== null && (
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed pointer-events-none"
                      style={{
                        left: computed.todayCol * computed.colWidth,
                        borderColor: 'var(--accent)',
                        opacity: 0.6,
                      }}
                    />
                  )}

                  {/* Bar */}
                  {offsets && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 flex items-center px-2 text-[10px]"
                      style={{
                        left: offsets.startCol * computed.colWidth + 2,
                        width: Math.max(
                          4,
                          offsets.span * computed.colWidth - 4,
                        ),
                        height: 22,
                        backgroundColor: style.fill,
                        border: `1px solid ${style.border}`,
                        color: style.text,
                      }}
                    >
                      {offsets.span * computed.colWidth > 80 && (
                        <span className="truncate display-uppercase text-[10px]">
                          {style.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LegendSwatch({
  label,
  status,
}: {
  label: string;
  status: TaskRow['status'];
}) {
  const s = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{
          width: 18,
          height: 10,
          backgroundColor: s.fill,
          border: `1px solid ${s.border}`,
        }}
      />
      {label}
    </span>
  );
}
