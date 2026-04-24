'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOrg } from '@/actions/org';

export function CreateOrgForm({ redirectOnSuccess = true }: { redirectOnSuccess?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '');

    startTransition(async () => {
      const result = await createOrg({ name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      if (redirectOnSuccess) {
        router.push(`/orgs/${result.slug}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="org-name">Organisation name</Label>
        <Input
          id="org-name"
          name="name"
          type="text"
          placeholder="Pang & Chiu"
          autoComplete="organization"
          required
          maxLength={120}
        />
        <p className="text-xs text-[color:var(--foreground)]/60">
          A URL-friendly slug is generated automatically.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Creating…' : 'Create organisation'}
      </Button>
    </form>
  );
}
