import { z } from "zod";
import { emailList, isValidEmail, requiredText } from "@/lib/validation/common";

/** Email composer payload, validated on the client and again in the sendApplicationEmail action. */
export const composeEmailSchema = z.object({
  applicationId: z.string().min(1).max(50),
  to: z.string().trim().min(1, "Recipient is required").max(320).refine(isValidEmail, "Enter a valid email address"),
  cc: emailList,
  bcc: emailList,
  subject: requiredText("Subject", 500),
  html: requiredText("Body", 200_000),
  text: z.string().max(200_000),
  documentIds: z.array(z.string().min(1).max(50)).max(10, "At most 10 attachments"),
  /** Generated once per composer session; makes double submission impossible. */
  idempotencyKey: z.string().min(16).max(64),
  /** Must be true to send again to a recipient that already received this application. */
  allowResend: z.boolean(),
});

export type ComposeEmailValues = z.infer<typeof composeEmailSchema>;

/** Total attachment budget. SES v2 allows 40 MB per message after base64 encoding. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;
