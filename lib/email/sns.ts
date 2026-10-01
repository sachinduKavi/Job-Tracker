import { createVerify } from "node:crypto";
import type { EmailStatus } from "@/lib/generated/prisma/enums";

/**
 * Amazon SNS message verification + SES notification parsing.
 *
 * SES publishes Delivery / Bounce / Complaint notifications to an SNS topic, which
 * POSTs them to /api/webhooks/ses. Because that endpoint is public, every message's
 * RSA signature is verified against the AWS-hosted signing certificate before it is
 * trusted. See docs/aws/email-events.md.
 */

export interface SnsMessage {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/** Only certificates/URLs served by SNS over HTTPS are trusted (prevents forged cert URLs). */
export function isTrustedSnsUrl(value: string | undefined, kind: "cert" | "subscribe"): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !SNS_HOST.test(url.hostname)) return false;
    return kind === "cert" ? url.pathname.endsWith(".pem") : true;
  } catch {
    return false;
  }
}

export function isSnsMessage(value: unknown): value is SnsMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.Type === "string" &&
    typeof v.MessageId === "string" &&
    typeof v.TopicArn === "string" &&
    typeof v.Message === "string" &&
    typeof v.Timestamp === "string" &&
    typeof v.Signature === "string" &&
    typeof v.SigningCertURL === "string" &&
    (v.SignatureVersion === "1" || v.SignatureVersion === "2")
  );
}

/** Canonical string that SNS signs (field order is fixed by the SNS spec). */
export function buildStringToSign(message: SnsMessage): string {
  const fields =
    message.Type === "Notification"
      ? (["Message", "MessageId", ...(message.Subject !== undefined ? ["Subject"] : []), "Timestamp", "TopicArn", "Type"] as const)
      : (["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"] as const);
  return fields.map((field) => `${field}\n${message[field as keyof SnsMessage] ?? ""}\n`).join("");
}

const certCache = new Map<string, string>();

export async function fetchSigningCert(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const cached = certCache.get(url);
  if (cached) return cached;
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch SNS signing certificate (${response.status})`);
  const pem = await response.text();
  if (!pem.includes("BEGIN CERTIFICATE")) throw new Error("Invalid SNS signing certificate");
  certCache.set(url, pem);
  return pem;
}

export async function verifySnsSignature(
  message: SnsMessage,
  getCert: (url: string) => Promise<string> = fetchSigningCert,
): Promise<boolean> {
  if (!isTrustedSnsUrl(message.SigningCertURL, "cert")) return false;
  const cert = await getCert(message.SigningCertURL);
  const verifier = createVerify(message.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1");
  verifier.update(buildStringToSign(message), "utf8");
  return verifier.verify(cert, message.Signature, "base64");
}

export interface ParsedSesEvent {
  sesMessageId: string;
  status: EmailStatus | null;
  /** Raw SES type, e.g. "Delivery", "Bounce". */
  type: string;
  description: string;
  timestamp: Date;
  detail: Record<string, unknown>;
}

/**
 * Parses the SES payload inside an SNS Notification. Supports both identity
 * notifications (`notificationType`) and configuration-set event publishing (`eventType`).
 * Transient bounces don't change status (SES keeps retrying); only permanent ones do.
 */
export function parseSesNotification(rawMessage: string): ParsedSesEvent | null {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawMessage);
  } catch {
    return null;
  }
  const type = String(body.notificationType ?? body.eventType ?? "");
  const mail = body.mail as { messageId?: string; timestamp?: string } | undefined;
  if (!type || !mail?.messageId) return null;

  if (type === "Delivery") {
    const delivery = body.delivery as { timestamp?: string; recipients?: string[] } | undefined;
    return {
      sesMessageId: mail.messageId,
      status: "DELIVERED",
      type,
      description: `Email delivered to ${delivery?.recipients?.join(", ") ?? "recipient"}`,
      timestamp: new Date(delivery?.timestamp ?? mail.timestamp ?? Date.now()),
      detail: { recipients: delivery?.recipients ?? [] },
    };
  }
  if (type === "Bounce") {
    const bounce = body.bounce as
      | { bounceType?: string; bounceSubType?: string; timestamp?: string; bouncedRecipients?: { emailAddress?: string }[] }
      | undefined;
    const permanent = bounce?.bounceType === "Permanent";
    return {
      sesMessageId: mail.messageId,
      status: permanent ? "BOUNCED" : null,
      type,
      description: `${permanent ? "Email bounced" : "Temporary bounce"} (${bounce?.bounceType ?? "Unknown"}/${bounce?.bounceSubType ?? "Unknown"})`,
      timestamp: new Date(bounce?.timestamp ?? mail.timestamp ?? Date.now()),
      detail: {
        bounceType: bounce?.bounceType,
        bounceSubType: bounce?.bounceSubType,
        recipients: bounce?.bouncedRecipients?.map((r) => r.emailAddress) ?? [],
      },
    };
  }
  if (type === "Complaint") {
    const complaint = body.complaint as { timestamp?: string; complaintFeedbackType?: string } | undefined;
    return {
      sesMessageId: mail.messageId,
      status: "COMPLAINT",
      type,
      description: "Recipient reported the email as spam",
      timestamp: new Date(complaint?.timestamp ?? mail.timestamp ?? Date.now()),
      detail: { feedbackType: complaint?.complaintFeedbackType },
    };
  }
  return {
    sesMessageId: mail.messageId,
    status: null,
    type,
    description: `SES event: ${type}`,
    timestamp: new Date(mail.timestamp ?? Date.now()),
    detail: {},
  };
}
