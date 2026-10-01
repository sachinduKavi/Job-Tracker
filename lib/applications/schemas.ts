import { z } from "zod";
import { ApplicationSource, ApplicationStatus } from "@/lib/generated/prisma/enums";
import {
  emailList,
  optionalDateString,
  optionalEmail,
  optionalHttpUrl,
  optionalText,
  parseDateOnly,
  parseEmailList,
  requiredText,
} from "@/lib/validation/common";

/**
 * Application form schema. Shared by the client form (zodResolver) and the
 * createApplication / updateApplication Server Actions. Values are strings as they
 * come from the form; `toApplicationInput` normalises them for the service layer.
 */
export const applicationFormSchema = z.object({
  company: requiredText("Company", 200),
  position: requiredText("Position", 200),
  dateApplied: optionalDateString,
  location: optionalText(200),
  jobUrl: optionalHttpUrl,
  source: z.enum(ApplicationSource),
  techStack: optionalText(1000),
  status: z.enum(ApplicationStatus),
  notes: optionalText(10_000),

  recipientEmail: optionalEmail,
  cc: emailList,
  bcc: emailList,
  emailSubject: optionalText(500),
  emailBody: optionalText(50_000),

  cvId: z.string().max(50),
  coverLetterId: z.string().max(50),
  additionalDocumentIds: z.array(z.string().max(50)).max(10),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export const MAX_TECHNOLOGIES = 30;

/** "React, Node.js, react" → ["React", "Node.js"] (case-insensitive de-duplication). */
export function parseTechStack(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,\n]/)) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 100);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_TECHNOLOGIES) break;
  }
  return out;
}

export interface ApplicationInput {
  company: string;
  position: string;
  dateApplied: Date | null;
  location: string | null;
  jobUrl: string | null;
  source: ApplicationSource;
  techStack: string[];
  status: ApplicationStatus;
  notes: string | null;
  recipientEmail: string | null;
  cc: string | null;
  bcc: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  documents: { documentId: string; role: "CV" | "COVER_LETTER" | "ADDITIONAL" }[];
}

const emptyToNull = (v: string) => (v.trim() === "" ? null : v.trim());
const joinEmails = (v: string) => {
  const list = parseEmailList(v);
  return list.length ? list.join(", ") : null;
};

export function toApplicationInput(values: ApplicationFormValues): ApplicationInput {
  const documents: ApplicationInput["documents"] = [];
  if (values.cvId) documents.push({ documentId: values.cvId, role: "CV" });
  if (values.coverLetterId) documents.push({ documentId: values.coverLetterId, role: "COVER_LETTER" });
  for (const id of new Set(values.additionalDocumentIds)) {
    if (id && id !== values.cvId && id !== values.coverLetterId) documents.push({ documentId: id, role: "ADDITIONAL" });
  }
  return {
    company: values.company.trim(),
    position: values.position.trim(),
    dateApplied: parseDateOnly(values.dateApplied),
    location: emptyToNull(values.location),
    jobUrl: emptyToNull(values.jobUrl),
    source: values.source,
    techStack: parseTechStack(values.techStack),
    status: values.status,
    notes: emptyToNull(values.notes),
    recipientEmail: emptyToNull(values.recipientEmail),
    cc: joinEmails(values.cc),
    bcc: joinEmails(values.bcc),
    emailSubject: emptyToNull(values.emailSubject),
    emailBody: emptyToNull(values.emailBody),
    documents,
  };
}

export const statusChangeSchema = z.object({
  applicationId: z.string().min(1).max(50),
  toStatus: z.enum(ApplicationStatus),
  note: optionalText(2000),
});

export type StatusChangeValues = z.infer<typeof statusChangeSchema>;

export const noteSchema = z.object({
  applicationId: z.string().min(1).max(50),
  note: requiredText("Note", 2000),
});
