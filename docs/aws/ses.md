# Amazon SES

JobTrack sends application emails with the **SES v2 API** (`@aws-sdk/client-sesv2`,
`SendEmailCommand`, "Simple" content with native attachments). All AWS code is in
`lib/email/ses.ts`; it runs only on the server.

> Never put real credentials in documentation, code or Git. Placeholders below:
> `AKIAXXXXXXXXXXXXXXXX`, `<secret>`, `123456789012`.

## Creating / configuring SES

1. AWS console → **Amazon Simple Email Service** → choose your region (top right). Everything
   below is per region and must match `AWS_REGION`.
2. If prompted, complete **Get started** (it asks for a sender identity and a test recipient).
3. Optional but recommended: **Configuration → Configuration sets → Create** `jobtrack`
   (needed for delivery tracking, see [email-events.md](email-events.md)). Set
   `SES_CONFIGURATION_SET=jobtrack` **only after** it exists — sends fail otherwise.

## Verifying the sender identity

**Email address:** Identities → Create identity → *Email address* → enter `you@example.com` →
click the verification link. Status becomes **Verified**.

**Domain (production):** Identities → Create identity → *Domain* → `yourdomain.com` → Easy DKIM
(RSA 2048) → publish the three CNAME records shown → wait for **Verified**. Recommended extras:
- Custom **MAIL FROM** domain (MX + SPF TXT records) for SPF alignment.
- **DMARC** TXT record, e.g. `_dmarc.yourdomain.com  "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`.

Set `SES_FROM_EMAIL` to the verified address (or any address at the verified domain) and
optionally `SES_FROM_NAME`, `SES_REPLY_TO`.

## SES sandbox considerations

New SES accounts are in the **sandbox** in each region:

- Recipients must be **verified identities** (you can only email yourself / addresses you verify).
- Limits: **200 emails / 24 h**, **1 email / second**.
- An unverified recipient produces `MessageRejected: Email address is not verified` — JobTrack
  shows "An email address is not verified in SES. In the SES sandbox, both sender and recipients
  must be verified."

## Moving out of the sandbox

SES console → **Account dashboard → Request production access**:

- Mail type: **Transactional**.
- Website URL: your JobTrack URL or personal site.
- Use case description (example): *"Personal job-application tool. Each email is written and
  sent manually by me to a single employer address with my CV attached, after an explicit
  confirmation step. Volume is under 20 emails per day. Bounces and complaints are tracked via
  SNS and I stop emailing addresses that bounce."*
- Acknowledge the AWS policies. Approval usually takes about a day; you may receive follow-up
  questions. Check **Account dashboard → Sending quota** afterwards.

## IAM permissions

The application needs only `ses:SendEmail` (and `ses:SendRawEmail`). Policies and how to scope
them to your identity / configuration set: [iam.md](iam.md).

## Required environment variables

| Variable | Example |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | `AKIAXXXXXXXXXXXXXXXX` (omit with an IAM role) |
| `AWS_SECRET_ACCESS_KEY` | `<secret>` (omit with an IAM role) |
| `SES_FROM_EMAIL` | `you@yourdomain.com` |
| `SES_FROM_NAME` | `Your Name` (optional) |
| `SES_REPLY_TO` | optional |
| `SES_CONFIGURATION_SET` | `jobtrack` (optional, for tracking) |
| `EMAIL_TRANSPORT` | `ses` |

Full reference: [environment-variables.md](../setup/environment-variables.md).

## Sending a test email

**From JobTrack:** upload a CV → create an application addressed to a mailbox you control
(verified, if in the sandbox) → *Send email* → *Review & send* → *Send Application*. Expect a
toast with the Message ID, status **Applied**, delivery **Sent**.

**From the AWS CLI** (isolates AWS problems from app problems):

```bash
aws sesv2 send-email --region us-east-1 \
  --from-email-address you@yourdomain.com \
  --destination ToAddresses=you@yourdomain.com \
  --content '{"Simple":{"Subject":{"Data":"SES test"},"Body":{"Text":{"Data":"Hello from SES"}}}}'
```

**SES mailbox simulator** (works in the sandbox without verifying recipients):
`success@simulator.amazonses.com`, `bounce@simulator.amazonses.com`,
`complaint@simulator.amazonses.com` — useful to test delivery tracking.

## Troubleshooting

| Error / symptom | Cause | Fix |
| --- | --- | --- |
| "An email address is not verified in SES…" (`MessageRejected`) | Sandbox: recipient (or sender) not verified | Verify the recipient, use the simulator, or request production access |
| "The AWS credentials are not allowed to send email" (`AccessDenied[Exception]`) | IAM policy missing/too narrow (wrong region/identity ARN) | Attach the policy from [iam.md](iam.md); check the identity ARN region |
| "Invalid AWS credentials" (`UnrecognizedClientException`, `InvalidClientTokenId`, `SignatureDoesNotMatch`) | Wrong/inactive key, secret typo, whitespace in `.env` | Recreate the access key; restart the server |
| "No AWS credentials found on the server" | No keys and no role | Set the keys or attach an IAM role |
| "SES resource not found…" (`NotFoundException`) | `SES_CONFIGURATION_SET` does not exist in the region | Create it or clear the variable |
| "Email sending is paused…" / "account is suspended" | Reputation (high bounces/complaints) | SES console → Reputation metrics; contact AWS |
| "SES rate limit hit" | > 1 msg/s in sandbox, or quota | Wait and retry; request a higher quota |
| "SES_FROM_EMAIL is not configured" | Missing env var | Set it and restart |
| Email accepted but not received | Spam folder, missing DKIM/SPF/DMARC, recipient filtering | Verify a domain with DKIM; check SES → *Suppression list* and delivery events |

The original AWS error name/message is logged as `email.ses_failed` (never the email body).
More: [troubleshooting.md](../development/troubleshooting.md#ses).

## Production security recommendations

- Use an **IAM role** (instance profile / task role) instead of access keys; if keys are
  unavoidable, store them in a secret manager and rotate them every 90 days.
- Scope the policy to your identity ARN and configuration set ([iam.md](iam.md)), optionally
  with `ses:FromAddress` condition.
- Verify a **domain** with DKIM, SPF (custom MAIL FROM) and DMARC.
- Enable delivery tracking and watch bounce/complaint rates (keep bounces < 5 %, complaints < 0.1 %).
- Keep the account-level **suppression list** enabled (bounces & complaints).
- Keep `EMAIL_RATE_LIMIT_PER_HOUR` low; never use `EMAIL_TRANSPORT=mock` in production (it is refused).
- Enable AWS CloudTrail for SES API calls and set a billing alarm.
