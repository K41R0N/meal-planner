import type { AppState } from './types';

/**
 * One planned week, described only by counts and dates. It never carries recipe names,
 * targets, intake, notes or shopping contents, so it can be copied into a weekly log or,
 * later and with consent, counted in a pilot without reading anyone's food.
 */
export interface WeekActivity {
  /** The plan's own start date (YYYY-MM-DD). */
  weekStart: string;
  planConfirmed: boolean;
  /** Distinct grocery lines of this week's list marked bought or already owned. */
  shoppingLines: number;
  /** Ready-food batches cooked for this week. */
  cooksFinished: number;
  /** A confirmed plan, at least one shopping line and at least one finished cook. */
  useful: boolean;
}

export interface UsefulWeekCounts {
  /** Every planned week, oldest first. */
  weeks: WeekActivity[];
  usefulWeeks: number;
  /** Start date of the first useful week, or null. */
  firstUsefulWeek: string | null;
  /** Start date of the second useful week (the repeat the strategy measures), or null. */
  secondUsefulWeek: string | null;
  /** Batches cooked outside any planned week (single recipes, extra batches). */
  cooksOutsideWeeks: number;
}

/** The exact keys the counts may expose; tests fail if a new field appears without review. */
export const WEEK_ACTIVITY_FIELDS = [
  'weekStart',
  'planConfirmed',
  'shoppingLines',
  'cooksFinished',
  'useful',
] as const;
export const USEFUL_WEEK_COUNT_FIELDS = [
  'weeks',
  'usefulWeeks',
  'firstUsefulWeek',
  'secondUsefulWeek',
  'cooksOutsideWeeks',
] as const;

/**
 * Counts useful and repeat weeks from the record itself (evals register: "a confirmed
 * plan, meaningful shopping activity and at least one completed cooking session").
 * Activity is tied to a week by the IDs the record already keeps: shopping lines by the
 * list's scope (the week ID) and cooked batches by their week, so a Saturday shop for a
 * week that starts on Monday still counts for that week.
 */
export function countUsefulWeeks(state: AppState): UsefulWeekCounts {
  const experience = state.experience;
  if (!experience)
    return {
      weeks: [],
      usefulWeeks: 0,
      firstUsefulWeek: null,
      secondUsefulWeek: null,
      cooksOutsideWeeks: 0,
    };

  const linesByWeek = new Map<string, Set<string>>();
  const addLine = (scopeId: string, itemKey: string) => {
    const lines = linesByWeek.get(scopeId) ?? new Set<string>();
    lines.add(itemKey);
    linesByWeek.set(scopeId, lines);
  };
  for (const purchase of experience.purchases) addLine(purchase.scopeId, purchase.itemKey);
  for (const [key, coverage] of Object.entries(experience.groceryCoverage)) {
    const covered =
      (coverage.ownedQuantity ?? 0) > 0 ||
      (coverage.boughtQuantity ?? 0) > 0 ||
      coverage.ownedUnspecified ||
      coverage.boughtUnspecified;
    // Coverage is keyed by the same line key a purchase records.
    if (covered) addLine(coverage.scopeId, key);
  }

  const weekIds = new Set(experience.weeks.map((week) => week.id));
  const cooksByWeek = new Map<string, number>();
  let cooksOutsideWeeks = 0;
  for (const batch of experience.batches) {
    if (batch.weekId !== null && weekIds.has(batch.weekId))
      cooksByWeek.set(batch.weekId, (cooksByWeek.get(batch.weekId) ?? 0) + 1);
    else cooksOutsideWeeks += 1;
  }

  const weeks = [...experience.weeks]
    .sort(
      (a, b) => a.weekStart.localeCompare(b.weekStart) || a.createdAt.localeCompare(b.createdAt),
    )
    .map((week): WeekActivity => {
      const shoppingLines = linesByWeek.get(week.id)?.size ?? 0;
      const cooksFinished = cooksByWeek.get(week.id) ?? 0;
      return {
        weekStart: week.weekStart,
        planConfirmed: week.confirmed,
        shoppingLines,
        cooksFinished,
        useful: week.confirmed && shoppingLines > 0 && cooksFinished > 0,
      };
    });
  const useful = weeks.filter((week) => week.useful);
  return {
    weeks,
    usefulWeeks: useful.length,
    firstUsefulWeek: useful[0]?.weekStart ?? null,
    secondUsefulWeek: useful[1]?.weekStart ?? null,
    cooksOutsideWeeks,
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The weekly-log text: counts and dates only, nothing a person typed or ate. */
export function weekCountsText(counts: UsefulWeekCounts): string {
  const repeat = counts.secondUsefulWeek ? `, repeat ${counts.secondUsefulWeek}` : '';
  const first = counts.firstUsefulWeek ? ` (first ${counts.firstUsefulWeek}${repeat})` : '';
  return [
    'Mealbook weeks (counts only)',
    `Useful weeks: ${counts.usefulWeeks}${first}`,
    `Cooks outside planned weeks: ${counts.cooksOutsideWeeks}`,
    ...[...counts.weeks]
      .reverse()
      .map(
        (week) =>
          `${week.weekStart}: plan ${week.planConfirmed ? 'confirmed' : 'not confirmed'}, ` +
          `${plural(week.shoppingLines, 'shopping item')}, ${plural(week.cooksFinished, 'cook')}` +
          `${week.useful ? ', useful' : ''}`,
      ),
  ].join('\n');
}
