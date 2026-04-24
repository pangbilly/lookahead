'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { uncommitActivities } from '@/actions/activity';

export function UncommitButton({ programmeId }: { programmeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        'Uncommit will delete all activity rows for this programme. Continue?',
      )
    ) {
      return;
    }
    startTransition(async () => {
      await uncommitActivities(programmeId);
      router.refresh();
    });
  };

  return (
    <Button type="button" variant="outlined" size="sm" disabled={isPending} onClick={onClick}>
      {isPending ? 'Uncommitting…' : 'Uncommit'}
    </Button>
  );
}
