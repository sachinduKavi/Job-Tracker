import "server-only";
import { randomUUID } from "node:crypto";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { buildSendEmailInput, type ApplicationEmailPayload } from "@/lib/email/payload";

/**
 * Amazon SES integration — the ONLY module that talks to AWS.
 *
 * Credentials are resolved by the AWS SDK default provider chain on the server
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars locally, an IAM role in
 * production). They are never passed to, or reachable from, the browser.
 *
 * EMAIL_TRANSPORT=mock replaces SES with an in-memory outbox for local development
 * and automated tests (refused in production by lib/env.ts).
 * See docs/aws/ses.md and docs/features/email-sending.md.
 */

export interface SendResult {
  messageId: string;
}

/** Minimal client surface, so tests can inject a fake. */
export interface SesLikeClient {
  send(command: SendEmailCommand): Promise<{ MessageId?: string }>;
}

let sesClient: SesLikeClient | undefined;

function getSesClient(): SesLikeClient {
  if (!sesClient) sesClient = new SESv2Client({ region: getServerEnv().AWS_REGION, maxAttempts: 3 });
  return sesClient;
}

/** Test seam: replace the SES client (pass undefined to reset). */
export function setSesClientForTesting(client: SesLikeClient | undefined) {
  sesClient = client;
}

export interface MockOutboxEntry {
  messageId: string;
  payload: ApplicationEmailPayload;
  sentAt: Date;
}

const globalOutbox = globalThis as unknown as { __jobtrackMockOutbox?: MockOutboxEntry[] };

export function getMockOutbox(): MockOutboxEntry[] {
  globalOutbox.__jobtrackMockOutbox ??= [];
  return globalOutbox.__jobtrackMockOutbox;
}

/** Maps SES / AWS SDK errors to actionable messages (docs/development/troubleshooting.md). */
export function mapSesError(error: unknown): AppError {
  const name = (error as { name?: string })?.name ?? "";
  const message = (error as { message?: string })?.message ?? "";
  const known: Record<string, string> = {
    MessageRejected: `SES rejected the message: ${message}`,
    MailFromDomainNotVerifiedException: "The sender's MAIL FROM domain is not verified in SES",
    AccountSuspendedException: "Your SES account is suspended for sending",
    SendingPausedException: "Email sending is paused for this SES account or configuration set",
    LimitExceededException: "SES sending limit exceeded — try again later",
    TooManyRequestsException: "SES rate limit hit — try again in a moment",
    NotFoundException: "SES resource not found (check SES_CONFIGURATION_SET and the sender identity)",
    AccessDeniedException: "The AWS credentials are not allowed to send email (ses:SendEmail)",
    AccessDenied: "The AWS credentials are not allowed to send email (ses:SendEmail)",
    UnrecognizedClientException: "Invalid AWS credentials (access key not recognised)",
    InvalidClientTokenId: "Invalid AWS credentials (access key not recognised)",
    SignatureDoesNotMatch: "Invalid AWS credentials (secret key does not match)",
    CredentialsProviderError: "No AWS credentials found on the server",
    BadRequestException: `SES rejected the request: ${message}`,
  };
  if (/not verified/i.test(message)) {
    return new AppError(
      "EMAIL_SEND_FAILED",
      "An email address is not verified in SES. In the SES sandbox, both sender and recipients must be verified.",
    );
  }
  return new AppError("EMAIL_SEND_FAILED", known[name] ?? "Amazon SES could not send the email");
}

/**
 * Sends an application email through SES (or the mock outbox).
 * Throws AppError("EMAIL_SEND_FAILED") with an actionable message on failure.
 */
export async function sendApplicationEmail(payload: ApplicationEmailPayload): Promise<SendResult> {
  const env = getServerEnv();

  if (env.EMAIL_TRANSPORT === "mock") {
    const messageId = `mock-${randomUUID()}`;
    getMockOutbox().push({ messageId, payload, sentAt: new Date() });
    logger.info("email.mock_sent", { messageId, to: payload.to, attachments: payload.attachments?.length ?? 0 });
    return { messageId };
  }

  if (!payload.from) {
    throw new AppError("CONFIGURATION", "SES_FROM_EMAIL is not configured on the server");
  }

  try {
    const result = await getSesClient().send(new SendEmailCommand(buildSendEmailInput(payload)));
    if (!result.MessageId) throw new AppError("EMAIL_SEND_FAILED", "SES did not return a message ID");
    logger.info("email.ses_sent", { messageId: result.MessageId, to: payload.to });
    return { messageId: result.MessageId };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Log the AWS error name/message only — never the request (it contains the body).
    logger.error("email.ses_failed", { name: (error as Error)?.name, message: (error as Error)?.message });
    throw mapSesError(error);
  }
}
