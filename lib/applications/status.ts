import { ApplicationStatus } from "@/lib/generated/prisma/enums";

/**
 * Single source of truth for application statuses: labels, colours, grouping and
 * the allowed lifecycle transitions. UI code must import from here instead of
 * hard-coding status strings. See docs/features/status-tracking.md.
 */

export { ApplicationStatus };

export type StatusCategory = "draft" | "active" | "interview" | "offer" | "closed";

export interface StatusConfig {
  value: ApplicationStatus;
  label: string;
  description: string;
  category: StatusCategory;
  /** Tailwind classes for the status badge (light + dark). */
  badgeClassName: string;
  /** Chart colour (CSS colour value). */
  color: string;
}

export const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  DRAFT: {
    value: "DRAFT",
    label: "Draft",
    description: "Prepared but not yet sent",
    category: "draft",
    badgeClassName: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    color: "#a1a1aa",
  },
  APPLIED: {
    value: "APPLIED",
    label: "Applied",
    description: "Application submitted",
    category: "active",
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    color: "#3b82f6",
  },
  ACKNOWLEDGED: {
    value: "ACKNOWLEDGED",
    label: "Acknowledged",
    description: "Employer confirmed receipt",
    category: "active",
    badgeClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    color: "#0ea5e9",
  },
  HR_SCREENING: {
    value: "HR_SCREENING",
    label: "HR Screening",
    description: "Initial screening with HR",
    category: "interview",
    badgeClassName: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    color: "#8b5cf6",
  },
  TECHNICAL_INTERVIEW: {
    value: "TECHNICAL_INTERVIEW",
    label: "Technical Interview",
    description: "Technical assessment or interview",
    category: "interview",
    badgeClassName: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    color: "#a855f7",
  },
  FINAL_INTERVIEW: {
    value: "FINAL_INTERVIEW",
    label: "Final Interview",
    description: "Final round",
    category: "interview",
    badgeClassName: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    color: "#d946ef",
  },
  OFFER: {
    value: "OFFER",
    label: "Offer",
    description: "Offer received",
    category: "offer",
    badgeClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    color: "#10b981",
  },
  REJECTED: {
    value: "REJECTED",
    label: "Rejected",
    description: "Employer declined",
    category: "closed",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    color: "#ef4444",
  },
  WITHDRAWN: {
    value: "WITHDRAWN",
    label: "Withdrawn",
    description: "You withdrew the application",
    category: "closed",
    badgeClassName: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    color: "#f59e0b",
  },
  NO_RESPONSE: {
    value: "NO_RESPONSE",
    label: "No Response",
    description: "No reply from the employer",
    category: "closed",
    badgeClassName: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    color: "#78716c",
  },
};

/** Statuses in lifecycle order (used for selects, filters and charts). */
export const APPLICATION_STATUSES = Object.keys(STATUS_CONFIG) as ApplicationStatus[];

/** The forward pipeline. A later stage may be reached directly (stages can be skipped). */
export const PIPELINE: readonly ApplicationStatus[] = [
  "DRAFT",
  "APPLIED",
  "ACKNOWLEDGED",
  "HR_SCREENING",
  "TECHNICAL_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
];

export const INTERVIEW_STATUSES: readonly ApplicationStatus[] = APPLICATION_STATUSES.filter(
  (s) => STATUS_CONFIG[s].category === "interview",
);

/**
 * Allowed transitions. Rules:
 * - Forward movement along the pipeline, skipping stages allowed (APPLIED → TECHNICAL_INTERVIEW).
 * - DRAFT can only become APPLIED (sent) or WITHDRAWN (abandoned).
 * - REJECTED / WITHDRAWN can be reached from any submitted stage; NO_RESPONSE from any
 *   stage before an offer.
 * - REJECTED and WITHDRAWN are terminal.
 * - NO_RESPONSE can be re-opened when the employer replies late.
 */
export const STATUS_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: ["APPLIED", "WITHDRAWN"],
  APPLIED: [
    "ACKNOWLEDGED",
    "HR_SCREENING",
    "TECHNICAL_INTERVIEW",
    "FINAL_INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
    "NO_RESPONSE",
  ],
  ACKNOWLEDGED: [
    "HR_SCREENING",
    "TECHNICAL_INTERVIEW",
    "FINAL_INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
    "NO_RESPONSE",
  ],
  HR_SCREENING: ["TECHNICAL_INTERVIEW", "FINAL_INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "NO_RESPONSE"],
  TECHNICAL_INTERVIEW: ["FINAL_INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "NO_RESPONSE"],
  FINAL_INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN", "NO_RESPONSE"],
  OFFER: ["REJECTED", "WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
  NO_RESPONSE: ["ACKNOWLEDGED", "HR_SCREENING", "TECHNICAL_INTERVIEW", "REJECTED", "WITHDRAWN"],
};

export function getAllowedTransitions(from: ApplicationStatus): readonly ApplicationStatus[] {
  return STATUS_TRANSITIONS[from];
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

export function getStatusLabel(status: ApplicationStatus): string {
  return STATUS_CONFIG[status].label;
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && value in STATUS_CONFIG;
}
