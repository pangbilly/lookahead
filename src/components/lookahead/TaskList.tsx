'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setTaskStatus, type TaskStatus } from '@/actions/lookahead';

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  startDate: string | null;
  dueDate: string | null;
  activityExternalId: string | null;
  activityIsMilestone: 'task' | 'milestone' | 'summary' | null;
  activityByOthers: boolean | null;
  blockerNote: string | null;
};

type Props = {
  tasks: TaskRow[];
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export function TaskList({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[color:var(--foreground)]/70">
        No tasks yet. Pick a window above and click Generate.
      </p>
    );
  }

  const byOthers = tasks.filter((t) => t.activityByOthers);
  const mine = tasks.filter((t) => !t.activityByOthers);

  return (
    <div className="space-y-12">
      <Section title={`My tasks (${mine.length})`} tasks={mine} />
      {byOthers.length > 0 && (
        <Section
          title={`Waiting on others (${byOthers.length})`}
          tasks={byOthers}
          note="These activities are flagged by_others in the programme — someone outside the site team is on the hook."
        />
      )}
    </div>
  );
}

function Section({
  title,
  tasks,
  note,
}: {
  title: string;
  tasks: TaskRow[];
  note?: string;
}) {
  return (
    <section>
      <h2 className="display-uppercase text-[color:var(--foreground)] text-sm">
        {title}
      </h2>
      {note && (
        <p className="mt-2 text-xs text-[color:var(--foreground)]/60">{note}</p>
      )}
      <ul className="mt-4 divide-y divide-[color:var(--border)]/30 border border-[color:var(--border)]/40">
        {tasks.map((t) => (
          <TaskRowItem key={t.id} task={t} />
        ))}
      </ul>
    </section>
  );
}

function TaskRowItem({ task }: { task: TaskRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [blockerNote, setBlockerNote] = useState(task.blockerNote ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (nextStatus: TaskStatus, nextNote = blockerNote) => {
    setError(null);
    startTransition(async () => {
      const res = await setTaskStatus(task.id, nextStatus, nextNote);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li
      className={`px-5 py-4 ${status === 'done' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p
            className={`text-[color:var(--foreground-strong)] text-sm ${
              status === 'done' ? 'line-through' : ''
            }`}
          >
            {task.title}
          </p>
          <p className="mt-1 text-xs text-[color:var(--foreground)]/60">
            {task.activityExternalId && (
              <span>{task.activityExternalId} · </span>
            )}
            {task.activityIsMilestone === 'milestone' && <span>Milestone · </span>}
            {task.startDate ?? '—'} → {task.dueDate ?? '—'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={isPending}
              onClick={() => {
                setStatus(o.value);
                save(o.value);
              }}
              className={`display-uppercase text-xs px-3 h-9 border ${
                status === o.value
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                  : 'border-[color:var(--border)]/60 text-[color:var(--foreground)]/80 hover:border-[color:var(--accent)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'blocked' && (
        <div className="mt-3 flex items-center gap-3">
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
            className="flex-1 h-9 bg-transparent border border-[color:var(--border)]/60 px-3 text-xs text-[color:var(--foreground-strong)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:border-[color:var(--accent)]"
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
