/**
 * Pure, unit-testable consecutive-day answer streak calculation. Computed
 * client-side from existing `answers.created_at` timestamps rather than a
 * stored counter, so it can never drift from the source of truth and needs
 * no schema change.
 */

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a `dateKey()` string back into a local-midnight Date. Using
 *  `new Date(key)` directly would parse it as UTC midnight (ISO date-only
 *  rule) and could shift a day off in timezones behind UTC. */
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * @param timestamps ISO timestamps of the user's answers (any order)
 * @param now reference "current" time — injectable for tests
 * @returns consecutive-day streak ending today or yesterday; 0 if the most
 *          recent answer is older than yesterday (streak broken) or there
 *          are no answers.
 */
export function computeAnswerStreak(timestamps: string[], now: Date = new Date()): number {
  if (timestamps.length === 0) return 0;

  const uniqueDates = Array.from(new Set(timestamps.map((ts) => dateKey(new Date(ts))))).sort().reverse();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(yesterday);

  if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yesterdayKey) return 0;

  let streak = 1;
  let cursor = parseDateKey(uniqueDates[0]);
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDay = new Date(cursor);
    prevDay.setDate(prevDay.getDate() - 1);
    if (uniqueDates[i] === dateKey(prevDay)) {
      streak++;
      cursor = prevDay;
    } else {
      break;
    }
  }
  return streak;
}
