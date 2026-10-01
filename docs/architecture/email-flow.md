# Email Flow

## Sending an application email

```text
Composer (components/email/email-composer.tsx, client)
  1. Prefill: To/CC/BCC/subject/body from the application's draft, attachments from its
     linked documents (or the default CV/cover letter). Optional template → renderEmailTemplate().
  2. Body: plain text → textToHtml(), or raw HTML ("Edit HTML directly").
     Plain-text part = htmlToText(html) unless "Custom plain-text version" is on.
  3. Preview: HTML in a sandboxed iframe + plain-text tab.
  4. "Review & send" → client Zod validation → confirmation dialog
     (Company, Position, To, CC/BCC, attachments) → "Send Application".
  5. sendEmailAction(values)  — values include a per-session idempotencyKey.

Server (app/actions/email.ts → lib/email/service.ts → lib/email/ses.ts)
  a. requireAuth(); composeEmailSchema.safeParse()
  b. Application exists? SES_FROM_EMAIL configured (ses transport)?
  c. Idempotent replay? Same key already used → return the existing email, send nothing.
  d. Rate limit: emails created in the last hour (excluding FAILED) < EMAIL_RATE_LIMIT_PER_HOUR
  e. In-flight guard: no SENDING email for this application in the last 2 minutes
  f. Re-send guard: already SENT/DELIVERED to this address → require allowResend=true
     (the dialog shows a warning and a "Send again" button)
  g. sanitizeEmailHtml(html); derive text; load attachments (≤ 15 MB total)
  h. INSERT Email (status SENDING, unique idempotencyKey)  ← double-submit stops here
  i. SESv2 SendEmail (Simple content + native attachments, tags: application=APP-000N)
  j. Success → one transaction:
        Email: sesMessageId, sentAt, status SENT, EmailAttachment snapshot rows
        ApplicationEvent EMAIL_SENT
        if status = DRAFT → APPLIED (+ StatusHistory + STATUS_CHANGED), set dateApplied if empty
     Failure → Email status FAILED + errorMessage, ApplicationEvent EMAIL_FAILED,
               AppError("EMAIL_SEND_FAILED", actionable message)
  k. revalidatePath(...) → client toast "Application email sent" (+ SES Message ID) → details page
```

If SES accepted the message but step (j) fails (e.g. the database dropped), the error is
logged as `email.post_send_update_failed` with the message ID, and the user is **not** told the
send failed — that would invite a duplicate send. The Email row stays `SENDING`; reconcile it
manually (see [troubleshooting](../development/troubleshooting.md#email-stuck-in-sending)).

## Delivery tracking (asynchronous)

```text
Amazon SES ──(configuration set event destination: Delivery, Bounce, Complaint)──► SNS topic
SNS ──HTTPS POST──► /api/webhooks/ses   (public path; excluded from proxy.ts auth)
  1. Parse JSON, check shape (isSnsMessage)
  2. Optional topic allow-list (SES_SNS_TOPIC_ARN)
  3. Verify RSA signature (SignatureVersion 1/2) with the certificate from SigningCertURL,
     which must be https://sns.<region>.amazonaws.com/*.pem
  4. SubscriptionConfirmation → GET SubscribeURL (also host-checked)
  5. Notification → parseSesNotification(Message)
        Delivery → DELIVERED · Bounce(Permanent) → BOUNCED · Complaint → COMPLAINT
        Transient bounces / other events → no status change
  6. applySesEvent: find Email by sesMessageId; nextDeliveryStatus() only moves forward
     (late "Delivery" never overrides "Complaint"); update + timeline event.
     Application status is never changed (ADR-004).
```

Setup: [aws/email-events.md](../aws/email-events.md).

## Transports

| `EMAIL_TRANSPORT` | Behaviour | Allowed in production |
| --- | --- | --- |
| `ses` (default) | Real send through SES | yes |
| `mock` | Stores messages in an in-memory outbox and returns `mock-<uuid>` IDs | **no** (refused at startup) |

## Related

- [features/email-sending.md](../features/email-sending.md)
- [aws/ses.md](../aws/ses.md)
- [ADR-003](../decisions/adr-003-amazon-ses.md), [ADR-004](../decisions/adr-004-separate-application-and-email-status.md)
