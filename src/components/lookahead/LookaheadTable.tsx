'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTaskStatus, type TaskStatus } from '@/actions/lookahead';
import type { TaskRow } from './TaskList';

type Props = {
  tasks: TaskRow[];
  /**
   * When supplied, the Gantt header spans exactly this range at day
   * granularity. Use the active lookahead window's start/end so 2- or
   * 4-week windows render with day columns.
   */
  fixedWindow?: { start: string; end: string };
};

const STATUS_STYLES: Record<
  TaskStatus,
  { label: string; fill: string; border: string; text: string }
> = {
  todo: {
    label: 'To do',
    fill: 'transparent',
    border: 'var(--accent)',
    text: 'var(--foreground-strong)',
  },
  in_progress: {
    label: 'In prog.',
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
    label: 'Canc.',
    fill: 'transparent',
    border: 'rgba(128,128,128,0.4)',
    text: 'var(--foreground)',
  },
};

const STATUS_BUTTONS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type Granularity = 'day' | 'week' | 'month';

const DAY_COL = 32;
const WEEK_COL = 60;
const MONTH_COL = 72;

const LEFT_COL = 260;
const RIGHT_COL = 300;

function parseISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function startOfISOWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getUTCDay() + 6) % 7;
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
  colWidth: number;
  colLabels: string[];
  colSubLabels: string[] | null;
  weekendCols: Set<number>;
  todayCol: number | null;
};

function computeTimeline(
  tasks: TaskRow[],
  fixedWindow?: { start: string; end: string },
): Computed | null {
  let min: Date | null = null;
  let max: Date | null = null;

  if (fixedWindow) {
    min = parseISODate(fixedWindow.start);
    max = parseISODate(fixedWindow.end);
  } else {
    const withDates = tasks.filter((t) => t.startDate || t.dueDate);
    if (withDates.length === 0) return null;
    for (const t of withDates) {
      const s = t.startDate ? parseISODate(t.startDate) : null;
      const f = t.dueDate ? parseISODate(t.dueDate) : null;
      const lo = s ?? f;
      const hi = f ?? s;
      if (lo && (!min || lo < min)) min = lo;
      if (hi && (!max || hi > max)) max = hi;
    }
  }
  if (!min || !max) return null;

  const totalDays = daysBetween(min, max) + 1;
  let granularity: Granularity = 'day';
  if (!fixedWindow) {
    if (totalDays > 365) granularity = 'month';
    else if (totalDays > 60) granularity = 'week';
  }

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
      colWidth: DAY_COL,
      colLabels,
      colSubLabels,
      weekendCols,
      todayCol: todayDiff >= 0 && todayDiff < cols ? todayDiff : null,
    };
  }

  if (granularity === 'week') {
    const origin = startOfISOWeek(min);
    const endWeek = startOfISOWeek(max);
    const cols = Math.floor(daysBetween(origin, endWeek) / 7) + 1;
    const colLabels: string[] = [];
    for (let i = 0; i < cols; i++) {
      const d = addWeeks(origin, i);
      colLabels.push(`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`);
    }
    const todayWeek = Math.floor(daysBetween(origin, today) / 7);
    return {
      granularity,
      origin,
      cols,
      colWidth: WEEK_COL,
      colLabels,
      colSubLabels: null,
      weekendCols: new Set(),
      todayCol: todayWeek >= 0 && todayWeek < cols ? todayWeek : null,
    };
  }

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
    colWidth: MONTH_COL,
    colLabels,
    colSubLabels: null,
    weekendCols: new Set(),
    todayCol: todayMonth >= 0 && todayMonth < cols ? todayMonth : null,
  };
}

function taskBarOffsets(
  task: TaskRow,
  c: Computed,
): { startCol: number; span: number } | null {
  const s = task.startDate ? parseISODate(task.startDate) : null;
  const f = task.dueDate ? parseISODate(task.dueDate) : null;
  if (!s && !f) return null;
  const start = s ?? f!;
  const finish = f ?? s!;

  let a: number;
  let b: number;
  if (c.granularity === 'day') {
    a = daysBetween(c.origin, start);
    b = daysBetween(c.origin, finish);
  } else if (c.granularity === 'week') {
    a = Math.floor(daysBetween(c.origin, start) / 7);
    b = Math.floor(daysBetween(c.origin, finish) / 7);
  } else {
    a = monthsBetween(c.origin, start);
    b = monthsBetween(c.origin, finish);
  }
  a = Math.max(0, Math.min(a, c.cols - 1));
  b = Math.max(0, Math.min(b, c.cols - 1));
  return { startCol: a, span: Math.max(1, b - a + 1) };
}

export function LookaheadTable({ tasks, fixedWindow }: Props) {
  const computed = useMemo(
    () => computeTimeline(tasks, fixedWindow),
    [tasks, fixedWindow],
  );

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[color:var(--foreground)]/70">
        No tasks yet. Pick a window above and click Generate.
      </p>
    );
  }
  if (!computed) return null;

  const sorted = [...tasks].sort((a, b) => {
    const av = a.startDate ?? a.dueDate ?? '9999-12-31';
    const bv = b.startDate ?? b.dueDate ?? '9999-12-31';
    return av.localeCompare(bv);
  });
  const mine = sorted.filter((t) => !t.activityByOthers);
  const byOthers = sorted.filter((t) => t.activityByOthers);

  const trackWidth = computed.cols * computed.colWidth;
  const totalWidth = LEFT_COL + trackWidth + RIGHT_COL;

  return (
    <div className="mt-4 border border-[color:var(--border)]/40 overflow-x-auto">
      <div style={{ width: totalWidth }}>
        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[color:var(--border)]/40 text-[10px] text-[color:var(--foreground)]/70 display-uppercase">
          <span className="text-[color:var(--foreground)]/50">
            Granularity: {computed.granularity}
          </span>
          <span className="flex-1" />
          <LegendSwatch status="todo" />
          <LegendSwatch status="in_progress" />
          <LegendSwatch status="blocked" />
          <LegendSwatch status="done" />
        </div>

        {/* Date header */}
        <div
          className="flex border-b border-[color:var(--border)]/40 bg-[color:var(--foreground)]/5"
          style={{ height: computed.colSubLabels ? 48 : 32 }}
        >
          <div
            className="shrink-0 border-r border-[color:var(--border)]/40 flex items-center px-4"
            style={{ width: LEFT_COL }}
          >
            <span className="display-uppercase text-[10px] text-[color:var(--foreground)]/60">
              Task
            </span>
          </div>
          <div className="flex" style={{ width: trackWidth }}>
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
          <div
            className="shrink-0 border-l border-[color:var(--border)]/40 flex items-center px-4"
            style={{ width: RIGHT_COL }}
          >
            <span className="display-uppercase text-[10px] text-[color:var(--foreground)]/60">
              Status
            </span>
          </div>
        </div>

        {/* Sections */}
        <Section
          title={`My tasks (${mine.length})`}
          tasks={mine}
          computed={computed}
          trackWidth={trackWidth}
        />
        {byOthers.length > 0 && (
          <Section
            title={`Waiting on others (${byOthers.length})`}
            tasks={byOthers}
            computed={computed}
            trackWidth={trackWidth}
            subtle
          />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  tasks,
  computed,
  trackWidth,
  subtle,
}: {
  title: string;
  tasks: TaskRow[];
  computed: Computed;
  trackWidth: number;
  subtle?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <>
      <div
        className="flex items-center border-t border-b border-[color:var(--border)]/40 bg-[color:var(--foreground)]/3"
        style={{ height: 28 }}
      >
        <div
          className="display-uppercase text-[10px] px-4 text-[color:var(--foreground)]/70"
          style={{ width: LEFT_COL }}
        >
          {title}
        </div>
      </div>
      {tasks.map((t) => (
        <TaskLine
          key={t.id}
          task={t}
          computed={computed}
          trackWidth={trackWidth}
          subtle={subtle}
        />
      ))}
    </>
  );
}

function TaskLine({
  task,
  computed,
  trackWidth,
  subtle,
}: {
  task: TaskRow;
  computed: Computed;
  trackWidth: number;
  subtle?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [blockerNote, setBlockerNote] = useState(task.blockerNote ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const offsets = taskBarOffsets(task, computed);
  const barStyle = STATUS_STYLES[status];

  const save = (next: TaskStatus, note = blockerNote) => {
    setError(null);
    startTransition(async () => {
      const res = await setTaskStatus(task.id, next, note);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div
        className={`flex border-b border-[color:var(--border)]/15 ${
          subtle ? 'opacity-80' : ''
        } ${status === 'done' ? 'opacity-60' : ''}`}
        style={{ height: 44 }}
      >
        {/* Task info */}
        <div
          className="shrink-0 border-r border-[color:var(--border)]/40 flex flex-col justify-center px-4"
          style={{ width: LEFT_COL }}
        >
          <p
            className={`text-xs text-[color:var(--foreground-strong)] truncate ${
              status === 'done' ? 'line-through' : ''
            }`}
            title={task.title}
          >
            {task.activityIsMilestone === 'milestone' ? '◆ ' : ''}
            {task.title}
          </p>
          <p className="text-[10px] text-[color:var(--foreground)]/60 truncate">
            {task.activityExternalId ?? ''}
            {task.startDate && task.dueDate
              ? ` · ${task.startDate} → ${task.dueDate}`
              : task.startDate || task.dueDate
                ? ` · ${task.startDate ?? '—'} → ${task.dueDate ?? '—'}`
                : ''}
          </p>
        </div>

        {/* Gantt track */}
        <div
          className="relative shrink-0"
          style={{ width: trackWidth, height: 44 }}
        >
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
          {offsets && (
            <div
              className="absolute top-1/2 -translate-y-1/2 flex items-center px-2 text-[10px]"
              style={{
                left: offsets.startCol * computed.colWidth + 2,
                width: Math.max(4, offsets.span * computed.colWidth - 4),
                height: 22,
                backgroundColor: barStyle.fill,
                border: `1px solid ${barStyle.border}`,
                color: barStyle.text,
              }}
            >
              {offsets.span * computed.colWidth > 80 && (
                <span className="truncate display-uppercase text-[10px]">
                  {barStyle.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status controls */}
        <div
          className="shrink-0 border-l border-[color:var(--border)]/40 flex items-center gap-1.5 px-3"
          style={{ width: RIGHT_COL }}
        >
          {STATUS_BUTTONS.map((s) => {
            const active = status === s;
            const label = STATUS_STYLES[s].label;
            return (
              <button
                key={s}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setStatus(s);
                  save(s);
                }}
                className={`display-uppercase text-[10px] h-8 px-2 flex-1 border transition-colors ${
                  active
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                    : 'border-[color:var(--border)]/60 text-[color:var(--foreground)]/80 hover:border-[color:var(--accent)]'
                }`}
                title={label}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blocker note row */}
      {status === 'blocked' && (
        <div
          className="flex border-b border-[color:var(--border)]/15 bg-[color:var(--foreground)]/3"
          style={{ height: 36 }}
        >
          <div className="shrink-0" style={{ width: LEFT_COL }} />
          <div
            className="shrink-0 flex items-center px-3"
            style={{ width: trackWidth + RIGHT_COL }}
          >
            <input
              type="text"
              value={blockerNote}
              placeholder="What's blocking this? (press enter to save)"
              onChange={(e) => setBlockerNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  save('blocked', blockerNote);
                }
              }}
              className="flex-1 h-8 bg-transparent border border-[color:var(--border)]/60 px-3 text-xs text-[color:var(--foreground-strong)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:border-[color:var(--accent)]"
            />
          </div>
        </div>
      )}

      {/* Error row */}
      {error && (
        <div className="flex border-b border-[color:var(--border)]/15">
          <div className="shrink-0" style={{ width: LEFT_COL }} />
          <div className="px-3 py-1 text-[10px] text-[color:var(--accent)]">
            {error}
          </div>
        </div>
      )}
    </>
  );
}

function LegendSwatch({ status }: { status: TaskStatus }) {
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
      {s.label}
    </span>
  );
}
