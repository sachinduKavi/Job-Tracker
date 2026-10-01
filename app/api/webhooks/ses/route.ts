import { getServerEnv } from "@/lib/env";
import { applySesEvent } from "@/lib/email/delivery-events";
import { isSnsMessage, isTrustedSnsUrl, parseSesNotification, verifySnsSignature } from "@/lib/email/sns";
import { logger } from "@/lib/logger";

/**
 * SES → SNS → HTTPS webhook for delivery tracking (Delivery / Bounce / Complaint).
 * Public endpoint (excluded from the auth proxy); authenticity is established by
 * verifying the SNS RSA signature and, optionally, the topic ARN.
 * See docs/aws/email-events.md.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 256 * 1024) return Response.json({ error: "Payload too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isSnsMessage(body)) return Response.json({ error: "Not an SNS message" }, { status: 400 });

  const expectedTopic = getServerEnv().SES_SNS_TOPIC_ARN;
  if (expectedTopic && body.TopicArn !== expectedTopic) {
    logger.warn("ses_webhook.unexpected_topic", { topic: body.TopicArn });
    return Response.json({ error: "Unexpected topic" }, { status: 403 });
  }

  let valid = false;
  try {
    valid = await verifySnsSignature(body);
  } catch (error) {
    logger.error("ses_webhook.signature_check_failed", { error: String(error) });
  }
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 403 });

  if (body.Type === "SubscriptionConfirmation") {
    if (!isTrustedSnsUrl(body.SubscribeURL, "subscribe")) {
      return Response.json({ error: "Untrusted SubscribeURL" }, { status: 400 });
    }
    const res = await fetch(body.SubscribeURL!, { cache: "no-store" });
    logger.info("ses_webhook.subscription_confirmed", { topic: body.TopicArn, status: res.status });
    return Response.json({ ok: res.ok });
  }

  if (body.Type === "Notification") {
    const event = parseSesNotification(body.Message);
    if (!event) return Response.json({ ok: true, ignored: "unrecognised payload" });
    const result = await applySesEvent(event);
    logger.info("ses_webhook.event", { type: event.type, sesMessageId: event.sesMessageId, result });
    return Response.json({ ok: true, result });
  }

  return Response.json({ ok: true });
}
