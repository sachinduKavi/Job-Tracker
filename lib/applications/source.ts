import { ApplicationSource } from "@/lib/generated/prisma/enums";

/** Where an application originated. Labels live here; never hard-code them in UI. */
export { ApplicationSource };

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  LINKEDIN: "LinkedIn",
  COMPANY_WEBSITE: "Company Website",
  JOB_BOARD: "Job Board",
  REFERRAL: "Referral",
  RECRUITER: "Recruiter",
  EMAIL: "Email",
  OTHER: "Other",
};

export const APPLICATION_SOURCES = Object.keys(SOURCE_LABELS) as ApplicationSource[];

export function getSourceLabel(source: ApplicationSource): string {
  return SOURCE_LABELS[source];
}

export function isApplicationSource(value: unknown): value is ApplicationSource {
  return typeof value === "string" && value in SOURCE_LABELS;
}
