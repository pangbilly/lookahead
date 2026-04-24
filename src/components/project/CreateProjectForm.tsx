'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProject } from '@/actions/project';

type Props = {
  organizationId: string;
  organizationSlug: string;
};

export function CreateProjectForm({ organizationId, organizationSlug }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createProject(organizationId, {
        name: String(form.get('name') ?? ''),
        client: String(form.get('client') ?? ''),
        description: String(form.get('description') ?? ''),
        startDate: String(form.get('startDate') ?? ''),
        endDate: String(form.get('endDate') ?? ''),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orgs/${organizationSlug}/projects/${result.projectId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="NOS09"
          required
          maxLength={160}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client">Client (optional)</Label>
        <Input
          id="client"
          name="client"
          type="text"
          placeholder="Thames Water"
          maxLength={160}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date (optional)</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={1000}
          className="flex w-full border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground-strong)] placeholder:text-[color:var(--foreground)]/50 focus-visible:outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]"
        />
      </div>

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}
