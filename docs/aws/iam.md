# IAM

JobTrack's server needs exactly one capability: **send email through SES**. Grant nothing else.
Do not use `AdministratorAccess`, `AmazonSESFullAccess` or the root user's keys.

## Minimum policy

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

`ses:SendEmail` is what the SES v2 `SendEmail` API checks; `ses:SendRawEmail` is included because
SES evaluates it for some message types/attachments.

## Recommended scoped policy

Restrict to your verified identity and (if used) configuration set, and pin the From address:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "JobTrackSendEmailScoped",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": [
        "arn:aws:ses:us-east-1:123456789012:identity/yourdomain.com",
        "arn:aws:ses:us-east-1:123456789012:configuration-set/jobtrack"
      ],
      "Condition": {
        "StringEquals": { "ses:FromAddress": "you@yourdomain.com" }
      }
    }
  ]
}
```

Replace the region, account ID (`123456789012`), identity (domain or email address) and
configuration set name. If you verified an email address instead of a domain, the identity ARN is
`…:identity/you@example.com`. If sends fail with `AccessDenied` after scoping, the ARN usually
names the wrong region or identity — the error message from SES includes the ARN it checked.

## Local development — IAM user

1. IAM → **Users → Create user** `jobtrack-local` (no console access).
2. **Add permissions → Create inline policy** → paste the policy above.
3. **Security credentials → Create access key** → *Application running outside AWS*.
4. Put the key ID/secret in `.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
5. Rotate: create a second key, update `.env`, restart, deactivate and delete the old key.

## Production — IAM role (preferred)

Attach the policy to the role of the compute running JobTrack — EC2 instance profile, ECS task
role, App Runner instance role, Lambda execution role, etc. Leave `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` **unset**; the AWS SDK default provider chain picks up temporary role
credentials automatically.

Hosting outside AWS (e.g. Vercel, a VPS): use an IAM user with the scoped policy and store the
keys in the platform's secret store, or use OIDC federation if the platform supports it.

## SNS (delivery tracking)

The application does **not** need SNS permissions. SES publishes to SNS using its own service
principal (configured when you add the event destination); SNS calls the webhook over HTTPS.
See [email-events.md](email-events.md).

## If a key leaks

1. IAM → the user → **Deactivate** the access key immediately, then delete it.
2. Check CloudTrail for `SendEmail` calls you did not make and SES sending statistics.
3. Create a new key, update the secret store / `.env`, restart.
