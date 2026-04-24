import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-10 py-8">
        <Link
          href="/"
          className="display-uppercase text-[color:var(--foreground-strong)] text-sm"
        >
          Lookahead
        </Link>
        <nav className="flex items-center gap-8">
          <Link
            href="/login"
            className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
          >
            Log in
          </Link>
          <Button asChild variant="outlined" size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-start justify-center px-10 pb-20">
        <h1 className="max-w-5xl display-uppercase text-[color:var(--foreground-strong)] text-5xl leading-[1.05] md:text-7xl lg:text-[96px]">
          Upload your programme.
          <br />
          Get a lookahead your site team can actually use.
        </h1>

        <p className="mt-10 max-w-2xl text-lg text-[color:var(--foreground)] leading-relaxed">
          Lookahead translates Primavera P6 and MS Project programmes into plain-English
          site tasks. Assign to your team. Track what&apos;s moving, what&apos;s slipping,
          what&apos;s blocked.
        </p>

        <div className="mt-12 flex items-center gap-6">
          <Button asChild size="lg">
            <Link href="/signup">Request access</Link>
          </Button>
          <Link
            href="/login"
            className="display-uppercase text-xs text-[color:var(--foreground)] hover:text-[color:var(--foreground-strong)]"
          >
            Already have an account →
          </Link>
        </div>
      </section>

      <footer className="border-t border-[color:var(--border)]/40 px-10 py-6">
        <p className="display-uppercase text-xs text-[color:var(--foreground)]/70">
          Lookahead · Private Beta · Built in Britain
        </p>
      </footer>
    </main>
  );
}
