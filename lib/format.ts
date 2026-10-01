/** Display formatting helpers (pure). Dates from DATE columns are UTC-midnight, so format in UTC. */

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" });

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return DATE.format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return DATE_TIME.format(new Date(date));
}

export function formatShortDate(date: Date | string): string {
  return SHORT.format(new Date(date));
}
