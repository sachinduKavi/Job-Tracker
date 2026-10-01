/**
 * Human-readable application identifiers (APP-0001).
 *
 * The database primary key is a CUID; `applicationId` is a display identifier derived
 * from a monotonic counter (see `nextApplicationId` in lib/applications/service.ts).
 * Numbers are zero-padded to 4 digits and grow naturally beyond 9999 (APP-10000).
 * See docs/features/applications.md#application-id-strategy.
 */
export const APPLICATION_ID_PREFIX = "APP";
const PAD_LENGTH = 4;

export function formatApplicationId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Application sequence must be a positive integer, got ${sequence}`);
  }
  return `${APPLICATION_ID_PREFIX}-${String(sequence).padStart(PAD_LENGTH, "0")}`;
}

const APPLICATION_ID_PATTERN = /^APP-(\d{4,})$/i;

export function parseApplicationId(value: string): number | null {
  const match = APPLICATION_ID_PATTERN.exec(value.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 ? n : null;
}

export function isApplicationId(value: string): boolean {
  return parseApplicationId(value) !== null;
}
