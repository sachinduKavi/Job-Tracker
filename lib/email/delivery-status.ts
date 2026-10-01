import { EmailStatus } from "@/lib/generated/prisma/enums";

/**
 * Email delivery status — deliberately separate from ApplicationStatus (ADR-004).
 * "Delivered" means the recipient's mail server accepted the message. It does NOT mean
 * anyone read it or that the employer reviewed the application.
 * See docs/features/email-sending.md#delivery-tracking.
 */
export { EmailStatus };

export const EMAIL_STATUS_CONFIG: Record<EmailStatus, { label: string; description: string; badgeClassName: string }> = {
  SENDING: {
    label: "Sending",
    description: "Handed to the send pipeline, waiting for SES",
    badgeClassName: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  SENT: {
    label: "Sent",
    description: "Accepted by Amazon SES",
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  DELIVERED: {
    label: "Delivered",
    description: "Accepted by the recipient's mail server (not necessarily read)",
    badgeClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  BOUNCED: {
    label: "Bounced",
    description: "Permanently rejected by the recipient's mail server",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  COMPLAINT: {
    label: "Complaint",
    description: "The recipient marked the email as spam",
    badgeClassName: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  FAILED: {
    label: "Failed",
    description: "SES refused the message; nothing was sent",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

/**
 * Status precedence for asynchronous SES events, which can arrive out of order.
 * A notification may only move the status "forward"; e.g. a late Delivery notification
 * never overwrites a Complaint.
 */
const RANK: Record<EmailStatus, number> = {
  FAILED: -1,
  SENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  BOUNCED: 3,
  COMPLAINT: 4,
};

export function nextDeliveryStatus(current: EmailStatus, incoming: EmailStatus): EmailStatus | null {
  if (current === "FAILED") return null;
  return RANK[incoming] > RANK[current] ? incoming : null;
}

export function getEmailStatusLabel(status: EmailStatus): string {
  return EMAIL_STATUS_CONFIG[status].label;
}
