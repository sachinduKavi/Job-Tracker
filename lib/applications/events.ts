import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ApplicationEventType } from "@/lib/generated/prisma/enums";

/**
 * Timeline events. Every important change to an application writes an
 * ApplicationEvent inside the same transaction as the change itself, so the timeline
 * can never drift from the data. See docs/features/applications.md#timeline.
 */
export async function recordEvent(
  tx: Prisma.TransactionClient,
  applicationId: string,
  eventType: ApplicationEventType,
  description: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.applicationEvent.create({
    data: { applicationId, eventType, description: description.slice(0, 500), metadata },
  });
}
