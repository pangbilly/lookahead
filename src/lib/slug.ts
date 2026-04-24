import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations } from '@/db/schema';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Returns a slug unique among organisations. If `base` is taken, appends
 * `-2`, `-3`, etc. until free. Caps at 20 attempts to avoid runaway.
 */
export async function uniqueOrgSlug(base: string): Promise<string> {
  const root = slugify(base) || 'org';
  for (let i = 1; i <= 20; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const clash = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  throw new Error('Could not generate a unique organisation slug after 20 attempts');
}
