/**
 * Pure helpers for analytics (unit-tested). The database does the grouping; these
 * functions shape results for charts. See docs/features/analytics.md.
 */

export interface MonthBucket {
  month: string; // YYYY-MM
  label: string; // "Oct 2026"
  count: number;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Returns the last `months` month keys ending with the month of `now` (oldest first). */
export function lastMonths(now: Date, months: number): string[] {
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** Fills gaps with zero so the time series has one bucket per month. */
export function fillMonthlySeries(rows: { month: string; count: number }[], now: Date, months = 12): MonthBucket[] {
  const counts = new Map(rows.map((r) => [r.month, r.count]));
  return lastMonths(now, months).map((month) => {
    const [y, m] = month.split("-").map(Number);
    return { month, label: MONTH_FORMAT.format(new Date(Date.UTC(y, m - 1, 1))), count: counts.get(month) ?? 0 };
  });
}

/** Sorts descending and folds everything after `limit` into an "Other" bucket. */
export function topN<T extends { name: string; count: number }>(rows: T[], limit: number): { name: string; count: number }[] {
  const sorted = [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (sorted.length <= limit) return sorted.map(({ name, count }) => ({ name, count }));
  const head = sorted.slice(0, limit).map(({ name, count }) => ({ name, count }));
  const rest = sorted.slice(limit).reduce((sum, r) => sum + r.count, 0);
  return [...head, { name: "Other", count: rest }];
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
