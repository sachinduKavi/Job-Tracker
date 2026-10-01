# Decision

ADR-003: Send application emails with Amazon SES (API v2) via the AWS SDK for JavaScript v3.

Status: Accepted · Date: 2026-10-01

## Context

JobTrack must send job application emails with attachments from the application, record exactly
what was sent, and learn whether the email was delivered.

## Problem

Which email delivery mechanism should be used?

## Options Considered

1. **Amazon SES** (SDK v3, `SESv2Client`)
2. SMTP through a personal mailbox (Gmail/Outlook app passwords, nodemailer)
3. Other ESPs (SendGrid, Postmark, Mailgun, Resend)

## Decision

Amazon SES v2 `SendEmail` with *Simple* content and native attachments, isolated in
`lib/email/ses.ts`. Delivery events via SES configuration set → SNS → signed HTTPS webhook.

## Reasons

- Very low cost and generous limits for low-volume transactional email.
- Message IDs plus event publishing (delivery, bounce, complaint) enable delivery tracking.
- Proper sender authentication (DKIM, SPF via custom MAIL FROM, DMARC) for good deliverability.
- IAM gives fine-grained, revocable, least-privilege credentials (and roles in production).
- SES v2 supports attachments in *Simple* content, so no hand-built MIME is needed.
- The project owner already has an AWS account.

## Consequences

- + Reliable sending with tracking and strong security controls.
- − Sandbox at first: recipients must be verified until production access is approved.
- − Domain verification and DNS work needed for best deliverability.
- − Sent emails don't appear in the user's personal mailbox "Sent" folder (use BCC to yourself or
  Reply-To if needed); replies go to `SES_REPLY_TO` / the sender address.
- The `mock` transport keeps development and tests independent of AWS.

## Future Considerations

Queue-based sending (SQS) with retries; Gmail/Outlook integrations for reply tracking as a
separate feature; per-user sender identities for multi-tenant SaaS.
