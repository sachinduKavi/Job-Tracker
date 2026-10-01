import type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";

/**
 * Builds the SES v2 SendEmail request (pure, unit-tested).
 * Uses "Simple" content with native attachments, so no hand-built MIME is needed.
 */

export interface EmailAttachmentInput {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export interface ApplicationEmailPayload {
  from: string;
  fromName?: string;
  replyTo?: string[];
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachmentInput[];
  configurationSetName?: string;
  /** Tags are published with SES events (useful for correlating). */
  tags?: Record<string, string>;
}

/** RFC 5322 display name: `"Jane Doe" <jane@example.com>`; SES encodes non-ASCII names. */
export function formatAddress(email: string, name?: string): string {
  if (!name) return email;
  const escaped = name.replace(/["\\]/g, "\\$&");
  return `"${escaped}" <${email}>`;
}

/** SES tag values allow only [A-Za-z0-9_-.@]. */
function sanitizeTag(value: string): string {
  return value.replace(/[^A-Za-z0-9_\-.@]/g, "_").slice(0, 256);
}

export function buildSendEmailInput(payload: ApplicationEmailPayload): SendEmailCommandInput {
  if (payload.to.length === 0) throw new Error("At least one recipient is required");
  const charset = "UTF-8";
  return {
    FromEmailAddress: formatAddress(payload.from, payload.fromName),
    Destination: {
      ToAddresses: payload.to,
      CcAddresses: payload.cc?.length ? payload.cc : undefined,
      BccAddresses: payload.bcc?.length ? payload.bcc : undefined,
    },
    ReplyToAddresses: payload.replyTo?.length ? payload.replyTo : undefined,
    Content: {
      Simple: {
        Subject: { Data: payload.subject, Charset: charset },
        Body: {
          Html: { Data: payload.html, Charset: charset },
          ...(payload.text ? { Text: { Data: payload.text, Charset: charset } } : {}),
        },
        Attachments: payload.attachments?.length
          ? payload.attachments.map((a) => ({
              FileName: a.filename,
              ContentType: a.contentType,
              RawContent: a.content,
              ContentDisposition: "ATTACHMENT",
              ContentTransferEncoding: "BASE64",
            }))
          : undefined,
      },
    },
    ConfigurationSetName: payload.configurationSetName || undefined,
    EmailTags: payload.tags
      ? Object.entries(payload.tags).map(([Name, Value]) => ({ Name: sanitizeTag(Name), Value: sanitizeTag(Value) }))
      : undefined,
  };
}
