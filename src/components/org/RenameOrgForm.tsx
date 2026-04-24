'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renameOrg } from '@/actions/org';

type Props = {
  organizationId: string;
  currentName: string;
};

export function RenameOrgForm({ organizationId, currentName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const name = String(new FormData(event.currentTarget).get('name') ?? '');

    startTransition(async () => {
      const result = await renameOrg(organizationId, { name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="rename-org">Organisation name</Label>
        <Input
          id="rename-org"
          name="name"
          type="text"
          defaultValue={currentName}
          required
          maxLength={120}
        />
        <p className="text-xs text-[color:var(--foreground)]/60">
          Renaming does not change the slug in the URL.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[color:var(--foreground)]/80" role="status">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
