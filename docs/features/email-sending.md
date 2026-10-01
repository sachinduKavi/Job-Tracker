# Email Sending (Amazon SES)

## Purpose

Send the application email — with CV and cover letter attached — directly from JobTrack, and
keep an exact record of what was sent, when, with which SES Message ID and how delivery went.

## User Flow

1. From the table row menu or details page choose **Send email** → `/applications/[id]/compose`.
2. The composer is prefilled from the application's draft (To, CC, BCC, subject, body) and its
   linked documents (or the default CV / cover letter). Optionally pick a **template**.
3. Write the body as plain text (converted to HTML) or switch on **Edit HTML directly**.
   Optionally provide a **custom plain-text version**.
4. Select **attachments** (total ≤ 15 MB).
5. Check the **Preview** (HTML in a sandboxed frame, and the plain-text part).
6. **Review & send** → confirmation dialog:

   ```text
   Send application?
   Company:    Veyrion
   Position:   Associate Software Engineer
   To:         people@company.com
   Attachment: Sachindu_Kavishka_CV.pdf
   [Cancel] [Send Application]
   ```

7. On success: toast with the SES Message ID → details page shows status **Applied**, delivery
   **Sent**, the message ID and the timeline entries.

## Architecture

```text
EmailComposer (client) ─► sendEmailAction (server action)
                             └─► sendEmailForApplication (lib/email/service.ts)
                                    ├─ sanitizeEmailHtml (lib/email/sanitize.ts)
                                    ├─ getDocumentWithContent (lib/documents/service.ts)
                                    ├─ sendApplicationEmail (lib/email/ses.ts) ─► SES v2 SendEmail
                                    └─ changeApplicationStatus(DRAFT → APPLIED)
SNS ─► /api/webhooks/ses ─► applySesEvent (lib/email/delivery-events.ts)
```

Full sequence: [architecture/email-flow.md](../architecture/email-flow.md).

## Implementation

### `lib/email/ses.ts`

- `sendApplicationEmail(payload)` → `{ messageId }`. Supports To, CC, BCC, Reply-To, subject,
  HTML, plain text and attachments (SES v2 `Simple` content with native `Attachments`).
- Request built by the pure `buildSendEmailInput()` (`lib/email/payload.ts`): UTF-8 charset,
  `"Name" <address>` From header, `ConfigurationSetName` when configured, tag
  `application=APP-000N`.
- `mapSesError()` turns AWS errors into actionable messages (not verified, access denied,
  invalid credentials, sending paused, throttling…).
- `EMAIL_TRANSPORT=mock` uses an in-memory outbox (`mock-<uuid>` IDs) for development and tests.

### After a successful send

1. Store the SES Message ID (`Email.sesMessageId`, unique).
2. Store `sentAt`.
3. Set `emailStatus = SENT` and save the attachment snapshot.
4. If the application is `DRAFT`, change it to `APPLIED` (StatusHistory + event) and set
   `dateApplied` to today if empty.
5. Write an `EMAIL_SENT` timeline event (`{ emailId, sesMessageId, attachments }`).
6. Return a success result → toast in the browser.

### Duplicate-send prevention

| Guard | How |
| --- | --- |
| Double click / retry of the same submit | The composer generates an `idempotencyKey` once per session; `Email.idempotencyKey` is unique. A repeated key returns the existing email ("Already sent — not sent again"). |
| Concurrent sends for one application | Rejected while another email for the application is `SENDING` (2-minute window). |
| Accidentally emailing the same recipient twice | If an email to that address was already `SENT`/`DELIVERED`, the server asks for confirmation; the dialog shows the warning and a **Send again** button (`allowResend`). |
| Explicit intent | Nothing is sent without the confirmation dialog. |

### Rate limiting

At most `EMAIL_RATE_LIMIT_PER_HOUR` (default 20) emails per rolling hour, counted from the
`Email` table (failed attempts excluded) — survives restarts and works across instances.

### Delivery tracking

| Status | Meaning |
| --- | --- |
| Sending | Row reserved, SES call in progress |
| Sent | SES accepted the message |
| Delivered | The recipient's mail server accepted it |
| Bounced | Permanent bounce (transient bounces don't change status) |
| Complaint | Recipient marked it as spam |
| Failed | SES refused it; nothing was sent |

Updates arrive through SES event publishing → SNS → `/api/webhooks/ses`
([aws/email-events.md](../aws/email-events.md)). Statuses only move forward (a late "Delivered"
never overrides "Complaint"). **Delivered does not mean the employer read or reviewed the
application**, and delivery events never change the application status
([ADR-004](../decisions/adr-004-separate-application-and-email-status.md)).

## Database Changes

`Email`, `EmailAttachment` tables; `Application.recipientEmail/cc/bcc/emailSubject/emailBody`
drafts. See [schema.md](../database/schema.md).

## Server Actions / API

- `sendEmailAction(values: ComposeEmailValues)` →
  `{ emailId, sesMessageId, status }`; error codes `VALIDATION`, `NOT_FOUND`, `RATE_LIMITED`,
  `DUPLICATE_SEND`, `EMAIL_SEND_FAILED`, `CONFIGURATION`.
- `POST /api/webhooks/ses` — SNS endpoint.

## Validation

`composeEmailSchema`: valid `to`; CC/BCC lists; subject ≤ 500; body required; ≤ 10 attachments;
idempotency key 16–64 chars. Server-side: HTML sanitised (must not be empty afterwards),
attachments must exist and total ≤ 15 MB.

## Configuration

`AWS_REGION`, credentials (or IAM role), `SES_FROM_EMAIL`, optional `SES_FROM_NAME`,
`SES_REPLY_TO`, `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN`, `EMAIL_TRANSPORT`,
`EMAIL_RATE_LIMIT_PER_HOUR` — [environment-variables.md](../setup/environment-variables.md).

## Security

Server-only credentials; sanitised HTML; sandboxed preview; confirmation; rate limit;
idempotency; signed webhook. [security.md](../architecture/security.md).

## Testing

- Unit: `tests/unit/email-payload.test.ts` (payload, text/HTML conversion, sanitisation, error mapping).
- Integration: `tests/integration/email-service.test.ts` — mock and fake-SES transports: message ID
  stored, Draft → Applied, attachments, idempotency, re-send confirmation, rate limit, SES failure
  path, missing sender, delivery events.
- E2E: the full composer flow with the mock transport.
- Manual: send to your own verified address ([aws/ses.md](../aws/ses.md#sending-a-test-email)).

## Error Handling

| Situation | User sees | Data |
| --- | --- | --- |
| Validation | Field errors + toast | nothing stored |
| Rate limit | "Rate limit reached…" | nothing stored |
| Already sent to recipient | Warning in dialog, **Send again** | nothing stored until confirmed |
| SES rejects | Actionable toast | Email `FAILED` + `errorMessage`, `EMAIL_FAILED` event; status unchanged |
| DB write after SES accepted fails | Success (to avoid duplicate sends) | logged `email.post_send_update_failed`; Email stays `SENDING` |

## Known Limitations

- Sending is synchronous (no queue/retry); SES SDK retries throttling up to 3 attempts.
- Replies are not tracked (no inbox integration).
- One `To` recipient per email.

## Future Improvements

Queue-based sending with retries, scheduled sends and follow-ups, open/click tracking (opt-in),
Gmail/Outlook reply detection.
