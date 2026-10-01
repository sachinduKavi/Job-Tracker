# AWS Setup (step by step)

```text
AWS Account
    ↓
IAM User/Role  (least privilege: ses:SendEmail, ses:SendRawEmail)
    ↓
SES (choose a region, e.g. us-east-1)
    ↓
Verified Identity (sender email or domain)
    ↓
Permissions (attach the policy to the user/role)
    ↓
Environment Variables (AWS_REGION, credentials, SES_FROM_EMAIL)
    ↓
Next.js Server (lib/email/ses.ts — server only)
    ↓
SES SendEmail (SESv2 API)
```

## 1. AWS account

Sign in to the AWS console with an account you control. Enable MFA on the root user and do
not use the root user's keys for JobTrack.

## 2. Choose a region

SES identities, sandbox status and quotas are **per region**. Pick one (e.g. `us-east-1`) and
use it everywhere below; it becomes `AWS_REGION`.

## 3. Verify a sender identity

SES console → **Configuration → Identities → Create identity**:

- **Email address** (quickest): enter the address, click the link AWS emails you.
- **Domain** (recommended for production): add the DKIM CNAME records to your DNS; enable
  Easy DKIM; optionally a custom MAIL FROM domain and a DMARC record. This improves deliverability.

The verified address (or any address at the verified domain) becomes `SES_FROM_EMAIL`.

## 4. Sandbox vs production access

New accounts start in the **SES sandbox**:
- You can send only **to verified identities** — every recipient must be verified too.
- Max 200 messages per 24 h, 1 per second.

For testing, verify your own second address as a recipient. To email employers, request
production access: SES console → **Account dashboard → Request production access**
(describe the use case: low-volume, one-to-one job application emails with explicit user
action; bounces/complaints handled). See [aws/ses.md](../aws/ses.md#moving-out-of-the-sandbox).

## 5. IAM permissions

Create an IAM user (local development) or role (production) with **only**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "JobTrackSendEmail",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

Tighter, resource-scoped versions are in [aws/iam.md](../aws/iam.md). Never use
`AdministratorAccess` or `AmazonSESFullAccess` for the application.

For an IAM user: **Security credentials → Create access key → "Application running outside AWS"**.
Copy the key ID and secret once.

## 6. Environment variables

```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA…"            # omit when the server has an IAM role
AWS_SECRET_ACCESS_KEY="…"
SES_FROM_EMAIL="you@yourdomain.com"
SES_FROM_NAME="Your Name"            # optional
EMAIL_TRANSPORT="ses"
```

Restart the server. Settings → *Email (Amazon SES)* should show the sender, region and
"AWS access keys present (server-side)".

## 7. Send a test email

1. Upload a CV (Documents).
2. Create an application whose recipient is an address you own (verified, if in sandbox).
3. *Send email* → *Review & send* → *Send Application*.
4. Expect: toast with the SES Message ID; details page shows **Applied** and **Sent**.
5. Check the inbox (and spam folder).

Failures show an actionable message (e.g. "An email address is not verified in SES…"); see
[aws/ses.md](../aws/ses.md#troubleshooting).

## 8. (Optional) Delivery tracking

Create a configuration set with an SNS event destination and subscribe the webhook — see
[aws/email-events.md](../aws/email-events.md).
