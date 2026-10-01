import "server-only";
import { db } from "@/lib/db";
import type { ApplicationEventType } from "@/lib/generated/prisma/enums";
import { logger } from "@/lib/logger";
import { recordEvent } from "@/lib/applications/events";
import { nextDeliveryStatus } from "@/lib/email/delivery-status";
import type { ParsedSesEvent } from "@/lib/email/sns";

/**
 * Applies an SES delivery event to the matching Email row and writes a timeline event.
 * Never changes the application status (ADR-004): a delivery is not a reply.
 */
const EVENT_TYPE: Record<string, ApplicationEventType> = {
  DELIVERED: "EMAIL_DELIVERED",
  BOUNCED: "EMAIL_BOUNCED",
  COMPLAINT: "EMAIL_COMPLAINT",
};

export async function applySesEvent(event: ParsedSesEvent): Promise<"updated" | "ignored" | "unknown-message"> {
  const email = await db.email.findUnique({ where: { sesMessageId: event.sesMessageId } });
  if (!email) {
    logger.warn("ses_event.unknown_message", { sesMessageId: event.sesMessageId, type: event.type });
    return "unknown-message";
  }
  const next = event.status ? nextDeliveryStatus(email.emailStatus, event.status) : null;
  if (!next) return "ignored";

  await db.$transaction(async (tx) => {
    await tx.email.update({ where: { id: email.id }, data: { emailStatus: next, statusUpdatedAt: event.timestamp } });
    await recordEvent(tx, email.applicationId, EVENT_TYPE[next], event.description, {
      emailId: email.id,
      sesMessageId: event.sesMessageId,
      ...event.detail,
    });
  });
  return "updated";
}
