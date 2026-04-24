'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateLookahead } from '@/actions/lookahead';

type Props = {
  projectId: string;
};

function nextMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function WindowPickerForm({ projectId }: Props) {
  const router = useRouter();
  const [weeks, setWeeks] = useState<2 | 4>(2);
  const [windowStart, setWindowStart] = useState(nextMondayISO());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await generateLookahead(projectId, { windowStart, weeks });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInfo(
        result.created === 0
          ? `Window published (${result.windowStart} → ${result.windowEnd}); all activities already had tasks.`
          : `Published ${result.created} task${result.created === 1 ? '' : 's'} for ${result.windowStart} → ${result.windowEnd}.`,
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="windowStart">Window start (Monday)</Label>
          <Input
            id="windowStart"
            name="windowStart"
            type="date"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weeks">Window length</Label>
          <div className="flex gap-2" id="weeks">
            <button
              type="button"
              onClick={() => setWeeks(2)}
              className={`flex-1 h-12 display-uppercase text-xs border ${
                weeks === 2
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                  : 'border-[color:var(--border)] text-[color:var(--foreground)]'
              }`}
            >
              2 weeks
            </button>
            <button
              type="button"
              onClick={() => setWeeks(4)}
              className={`flex-1 h-12 display-uppercase text-xs border ${
                weeks === 4
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground-strong)]'
                  : 'border-[color:var(--border)] text-[color:var(--foreground)]'
              }`}
            >
              4 weeks
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-[color:var(--foreground)]/80" role="status">
          {info}
        </p>
      )}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Asking Claude…' : 'Generate lookahead'}
      </Button>
    </form>
  );
}
