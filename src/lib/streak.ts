import { format, parseISO, subDays } from "date-fns";

/**
 * Longest run of consecutive calendar days ending at the user's most recent
 * completion day (local calendar dates, yyyy-MM-dd).
 */
export function computeStreak(completionDateKeys: string[]): number {
  const set = new Set(completionDateKeys);
  if (set.size === 0) return 0;

  const sortedDesc = [...set].sort((a, b) => b.localeCompare(a));
  let cursor = parseISO(sortedDesc[0]);
  let streak = 0;

  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    streak++;
    cursor = subDays(cursor, 1);
  }

  return streak;
}
