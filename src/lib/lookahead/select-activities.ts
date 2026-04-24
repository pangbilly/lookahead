/**
 * Select activities that fall into a lookahead window.
 *
 * Per CLAUDE.md §9:
 *   - include if milestone date in window
 *   - include if startDate in window
 *   - include if finishDate in window
 *   - include if in-progress: startDate <= windowEnd AND finishDate >= windowStart
 *   - exclude summary rows (they're groupings, not work)
 *   - by_others → surfaced in a separate "Waiting on" section downstream
 *   - sort by startDate asc, then totalFloat asc (critical items first)
 */
import { and, eq, gte, lte, ne, or, type SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { activities } from '@/db/schema';

export type SelectedActivity = {
  id: string;
  externalId: string | null;
  name: string;
  startDate: string | null;
  finishDate: string | null;
  remainingDurationDays: number | null;
  totalFloatDays: number | null;
  startIsActual: boolean;
  finishIsActual: boolean;
  startIsConstrained: boolean;
  finishIsConstrained: boolean;
  activityType: 'task' | 'milestone' | 'summary';
  byOthers: boolean;
};

export async function selectActivitiesForWindow(
  projectId: string,
  windowStart: string, // YYYY-MM-DD
  windowEnd: string,
): Promise<SelectedActivity[]> {
  const startInWindow = and(
    gte(activities.startDate, windowStart),
    lte(activities.startDate, windowEnd),
  )!;
  const finishInWindow = and(
    gte(activities.finishDate, windowStart),
    lte(activities.finishDate, windowEnd),
  )!;
  const inProgress = and(
    lte(activities.startDate, windowEnd),
    gte(activities.finishDate, windowStart),
  )!;
  const hitsWindow = or(startInWindow, finishInWindow, inProgress) as SQL<unknown>;

  const rows = await db
    .select({
      id: activities.id,
      externalId: activities.externalId,
      name: activities.name,
      startDate: activities.startDate,
      finishDate: activities.finishDate,
      remainingDurationDays: activities.remainingDurationDays,
      totalFloatDays: activities.totalFloatDays,
      startIsActual: activities.startIsActual,
      finishIsActual: activities.finishIsActual,
      startIsConstrained: activities.startIsConstrained,
      finishIsConstrained: activities.finishIsConstrained,
      activityType: activities.activityType,
      byOthers: activities.byOthers,
    })
    .from(activities)
    .where(
      and(
        eq(activities.projectId, projectId),
        ne(activities.activityType, 'summary'),
        hitsWindow,
      ),
    )
    .orderBy(
      sql`${activities.startDate} asc nulls last`,
      sql`${activities.totalFloatDays} asc nulls last`,
    );

  return rows.map((r) => ({
    ...r,
    activityType: r.activityType as 'task' | 'milestone' | 'summary',
  }));
}

/**
 * Exclude activities that have already finished with an Actual flag — they're
 * done, no point asking the site team to do them. A 2-week window may still
 * catch historical actuals if the window starts before today.
 */
export function filterOutCompleted(activities: SelectedActivity[]): SelectedActivity[] {
  return activities.filter((a) => !(a.finishIsActual && a.startIsActual));
}
