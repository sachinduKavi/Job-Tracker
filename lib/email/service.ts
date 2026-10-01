import "server-only";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { Prisma } from "@/lib/generated/prisma/client";
import { logger } from "@/lib/logger";
import { recordEvent } from "@/lib/applications/events";
import { changeApplicationStatus } from "@/lib/applications/service";
import { getDocumentWithContent } from "@/lib/documents/service";
import { htmlToText } from "@/lib/email/content";
import type { EmailAttachmentInput } from "@/lib/email/payload";
import { MAX_TOTAL_ATTACHMENT_BYTES, type ComposeEmailValues } from "@/lib/email/schemas";
import { sanitizeEmailHtml } from "@/lib/email/sanitize";
import { sendApplicationEmail } from "@/lib/email/ses";
import { parseEmailList } from "@/lib/validation/common";

/**
 * Application email send flow (orchestration). Steps:
 *
 *  1. Guard rails: application exists, sender configured, hourly rate limit,
 *     no in-flight send, explicit confirmation for re-sends.
 *  2. Reserve: insert an Email row (status SENDING) with the client's idempotency key.
 *     The unique index makes a double-submit fail here, before anything is sent.
 *  3. Send via lib/email/ses.ts.
 *  4. Success: store SES Message ID + sentAt, status SENT, attachment snapshot,
 *     move the application DRAFT → APPLIED, write EMAIL_SENT timeline event.
 *     Failure: status FAILED + error message + EMAIL_FAILED event.
 *
 * See docs/features/email-sending.md and docs/architecture/email-flow.md.
 */

const RATE_WINDOW_MS = 60 * 60 * 1000;
/** A SENDING row older than this is considered stale (process crashed mid-send). */
const IN_FLIGHT_WINDOW_MS = 2 * 60 * 1000;

export function isRateLimited(sentInWindow: number, limit: number): boolean {
  return sentInWindow >= limit;
}

async function loadAttachments(documentIds: string[]) {
  const attachments: (EmailAttachmentInput & { documentId: string; size: number })[] = [];
  let total = 0;
  for (const id of [...new Set(documentIds)]) {
    const { document, content } = await getDocumentWithContent(id);
    total += content.byteLength;
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new AppError("VALIDATION", "Attachments exceed the 15 MB total limit");
    }
    attachments.push({
      documentId: document.id,
      filename: document.originalFilename,
      contentType: document.mimeType,
      content: new Uint8Array(content),
      size: content.byteLength,
    });
  }
  return attachments;
}

export async function sendEmailForApplication(values: ComposeEmailValues) {
  const env = getServerEnv();

  const application = await db.application.findUnique({
    where: { id: values.applicationId },
    select: { id: true, applicationId: true, status: true, company: true, position: true, dateApplied: true },
  });
  if (!application) throw new AppError("NOT_FOUND", "Application not found");
  if (env.EMAIL_TRANSPORT === "ses" && !env.SES_FROM_EMAIL) {
    throw new AppError("CONFIGURATION", "SES_FROM_EMAIL is not configured on the server");
  }

  // Idempotent replay: the same key already produced an email → return it, don't resend.
  const replay = await db.email.findUnique({ where: { idempotencyKey: values.idempotencyKey } });
  if (replay) {
    if (replay.emailStatus === "FAILED") {
      throw new AppError("DUPLICATE_SEND", "This send attempt already failed. Reopen the composer to retry.");
    }
    return { email: replay, duplicate: true as const };
  }

  const now = Date.now();
  const sentLastHour = await db.email.count({
    where: { createdAt: { gte: new Date(now - RATE_WINDOW_MS) }, emailStatus: { not: "FAILED" } },
  });
  if (isRateLimited(sentLastHour, env.EMAIL_RATE_LIMIT_PER_HOUR)) {
    throw new AppError(
      "RATE_LIMITED",
      `Rate limit reached: at most ${env.EMAIL_RATE_LIMIT_PER_HOUR} emails per hour. Try again later.`,
    );
  }

  const inFlight = await db.email.count({
    where: {
      applicationId: application.id,
      emailStatus: "SENDING",
      createdAt: { gte: new Date(now - IN_FLIGHT_WINDOW_MS) },
    },
  });
  if (inFlight > 0) throw new AppError("DUPLICATE_SEND", "An email for this application is already being sent");

  if (!values.allowResend) {
    const previous = await db.email.findFirst({
      where: { applicationId: application.id, to: values.to, emailStatus: { in: ["SENT", "DELIVERED"] } },
      orderBy: { sentAt: "desc" },
    });
    if (previous) {
      throw new AppError(
        "DUPLICATE_SEND",
        `This application was already emailed to ${values.to} on ${previous.sentAt?.toUTCString() ?? "an earlier date"}. Confirm the re-send to continue.`,
      );
    }
  }

  const html = sanitizeEmailHtml(values.html);
  if (!html) throw new AppError("VALIDATION", "The email body is empty after sanitization", { html: "Body is empty" });
  const text = values.text.trim() || htmlToText(html);
  const cc = parseEmailList(values.cc);
  const bcc = parseEmailList(values.bcc);
  const attachments = await loadAttachments(values.documentIds);

  // Step 2: reserve (unique idempotencyKey blocks concurrent duplicates).
  let email;
  try {
    email = await db.email.create({
      data: {
        applicationId: application.id,
        to: values.to,
        cc: cc.join(", ") || null,
        bcc: bcc.join(", ") || null,
        subject: values.subject,
        body: html,
        textBody: text,
        idempotencyKey: values.idempotencyKey,
        emailStatus: "SENDING",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("DUPLICATE_SEND", "This email is already being sent");
    }
    throw error;
  }

  // Step 3: send.
  let messageId: string;
  try {
    ({ messageId } = await sendApplicationEmail({
      from: env.SES_FROM_EMAIL,
      fromName: env.SES_FROM_NAME || undefined,
      replyTo: env.SES_REPLY_TO ? [env.SES_REPLY_TO] : undefined,
      to: [values.to],
      cc,
      bcc,
      subject: values.subject,
      html,
      text,
      attachments,
      configurationSetName: env.SES_CONFIGURATION_SET || undefined,
      tags: { application: application.applicationId },
    }));
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Unexpected error while sending";
    await db.$transaction(async (tx) => {
      await tx.email.update({
        where: { id: email.id },
        data: { emailStatus: "FAILED", errorMessage: message, statusUpdatedAt: new Date() },
      });
      await recordEvent(tx, application.id, "EMAIL_FAILED", `Email to ${values.to} failed: ${message}`, {
        emailId: email.id,
      });
    });
    throw error instanceof AppError ? error : new AppError("EMAIL_SEND_FAILED", message);
  }

  // Step 4: record success. SES has already accepted the message, so a failure here must
  // not surface as "send failed" (the user might resend) — log it loudly instead.
  try {
    const sentAt = new Date();
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.email.update({
        where: { id: email.id },
        data: {
          sesMessageId: messageId,
          sentAt,
          emailStatus: "SENT",
          statusUpdatedAt: sentAt,
          attachments: {
            create: attachments.map((a) => ({
              documentId: a.documentId,
              filename: a.filename,
              mimeType: a.contentType,
              size: a.size,
            })),
          },
        },
      });
      await recordEvent(tx, application.id, "EMAIL_SENT", `Application email sent to ${values.to}`, {
        emailId: email.id,
        sesMessageId: messageId,
        attachments: attachments.map((a) => a.filename),
      });
      if (application.status === "DRAFT") {
        await changeApplicationStatus(application.id, "APPLIED", "Application email sent", tx);
        if (!application.dateApplied) {
          await tx.application.update({
            where: { id: application.id },
            data: { dateApplied: new Date(`${sentAt.toISOString().slice(0, 10)}T00:00:00Z`) },
          });
        }
      }
      return result;
    });
    return { email: updated, duplicate: false as const };
  } catch (error) {
    logger.error("email.post_send_update_failed", { emailId: email.id, messageId, error: String(error) });
    return { email: { ...email, sesMessageId: messageId, emailStatus: "SENT" as const }, duplicate: false as const };
  }
}

/** Recent sends, used by the Settings page to show rate-limit usage. */
export async function getEmailUsage() {
  const env = getServerEnv();
  const sentLastHour = await db.email.count({
    where: { createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) }, emailStatus: { not: "FAILED" } },
  });
  return { sentLastHour, limit: env.EMAIL_RATE_LIMIT_PER_HOUR, transport: env.EMAIL_TRANSPORT };
}
