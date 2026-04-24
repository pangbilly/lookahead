import Link from 'next/link';
import { Suspense } from 'react';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata = {
  title: 'Create an account — Lookahead',
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-10 py-8">
        <Link
          href="/"
          className="display-uppercase text-[color:var(--foreground-strong)] text-sm"
        >
          Lookahead
        </Link>
        <Link
          href="/login"
          className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
        >
          Log in
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-10">
          <div className="space-y-3">
            <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-3xl">
              Create an account
            </h1>
            <p className="text-sm text-[color:var(--foreground)]/80">
              Log in to send and receive invitations, manage your organisation, and
              track programme work.
            </p>
          </div>

          <GoogleButton />

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[color:var(--border)]/40" />
            <span className="display-uppercase text-xs text-[color:var(--foreground)]/60">
              or
            </span>
            <div className="h-px flex-1 bg-[color:var(--border)]/40" />
          </div>

          <Suspense fallback={null}>
            <SignUpForm />
          </Suspense>

          <p className="text-center text-xs text-[color:var(--foreground)]/70">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[color:var(--accent)] hover:underline underline-offset-4"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
