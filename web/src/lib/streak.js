const dayKey = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/**
 * Current daily streak: consecutive calendar days, ending today, with at
 * least one *solved* submission each day. Today doesn't have to be solved
 * yet for the streak to still show — an unbroken chain ending yesterday
 * still counts, since today isn't over — but any other gap breaks it.
 */
export function computeCurrentStreak(submissions) {
  const solvedDays = new Set(
    (submissions ?? [])
      .filter((s) => s.status === 'solved' && s.submittedAt)
      .map((s) => s.submittedAt.slice(0, 10))
  );
  if (solvedDays.size === 0) return 0;

  let cursor = new Date();
  if (!solvedDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!solvedDays.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (solvedDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
