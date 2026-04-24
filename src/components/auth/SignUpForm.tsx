'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpCredentials } from '@/actions/auth';

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get('email') ?? '';
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    startTransition(async () => {
      const result = await signUpCredentials({ name, email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={prefilledEmail}
          readOnly={Boolean(prefilledEmail)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-[color:var(--foreground)]/60">At least 8 characters.</p>
      </div>

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} size="lg" className="w-full">
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
