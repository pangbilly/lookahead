import Link from 'next/link';
import { Suspense } from 'react';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Log in — Lookahead',
};

export default function LoginPage() {
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
          href="/signup"
          className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
        >
          Sign up
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-10">
          <div className="space-y-3">
            <h1 className="display-uppercase text-[color:var(--foreground-strong)] text-3xl">
              Log in
            </h1>
            <p className="text-sm text-[color:var(--foreground)]/80">
              Welcome back.
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
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-[color:var(--foreground)]/70">
            New to Lookahead?{' '}
            <Link
              href="/signup"
              className="text-[color:var(--accent)] hover:underline underline-offset-4"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
