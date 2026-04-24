'use server';

import { eq } from 'drizzle-orm';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/password';
import { signUpSchema, type SignUpInput } from '@/lib/validations/auth';

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function signUpCredentials(input: SignUpInput): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: 'An account with that email already exists. Log in instead.' };
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ name, email, passwordHash });

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Account created but sign-in failed. Try logging in.' };
    }
    throw e;
  }

  return { ok: true };
}

export async function loginCredentials(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    await signIn('credentials', { email, password, redirect: false });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Invalid email or password.' };
    }
    throw e;
  }
}

export async function loginWithGoogle() {
  await signIn('google', { redirectTo: '/dashboard' });
}

export async function logout() {
  const { signOut } = await import('@/auth');
  await signOut({ redirectTo: '/' });
}
