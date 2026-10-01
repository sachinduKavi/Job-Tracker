# Email Delivery Events (SES → SNS → JobTrack)

Delivery tracking turns an email's status from **Sent** into **Delivered**, **Bounced** or
**Complaint**. It is optional: without it, emails simply stay **Sent**.

## How it works

```text
JobTrack ──SendEmail (ConfigurationSetName=jobtrack)──► SES
SES ──event destination (Delivery, Bounce, Complaint)──► SNS topic jobtrack-ses-events
SNS ──HTTPS POST (signed JSON)──► https://<your-host>/api/webhooks/ses
JobTrack: verify signature → parse → update Email.emailStatus → timeline event
```

Implementation: `app/api/webhooks/ses/route.ts`, `lib/email/sns.ts` (verification + parsing),
`lib/email/delivery-events.ts` (database update). Flow details: [email-flow.md](../architecture/email-flow.md#delivery-tracking-asynchronous).

The endpoint must be reachable from the internet over HTTPS — it cannot work against
`localhost` without a tunnel (e.g. `cloudflared`/`ngrok`).

## Setup

1. **SNS topic:** SNS console (same region) → Topics → Create topic → *Standard* →
   `jobtrack-ses-events`. Note the ARN.
2. **Configuration set:** SES → Configuration sets → Create `jobtrack`.
3. **Event destination:** in the configuration set → *Event destinations* → Add destination →
   event types **Deliveries, Hard bounces (Bounce), Complaints** (optionally Rejects) →
   destination type **Amazon SNS** → topic `jobtrack-ses-events`.
4. **Subscription:** SNS topic → Create subscription → protocol **HTTPS** → endpoint
   `https://<your-host>/api/webhooks/ses`. Leave *raw message delivery* **off** (JobTrack expects
   the standard signed SNS envelope).
5. JobTrack confirms the subscription automatically (it fetches the `SubscribeURL` after
   verifying the signature). The subscription status becomes **Confirmed**; the server logs
   `ses_webhook.subscription_confirmed`.
6. Configure JobTrack and restart:

   ```env
   SES_CONFIGURATION_SET="jobtrack"
   SES_SNS_TOPIC_ARN="arn:aws:sns:us-east-1:123456789012:jobtrack-ses-events"
   ```

## Event mapping

| SES event | JobTrack email status | Timeline event |
| --- | --- | --- |
| Delivery | Delivered | EMAIL_DELIVERED |
| Bounce, `bounceType = Permanent` | Bounced | EMAIL_BOUNCED |
| Bounce, `Transient` / `Undetermined` | *(unchanged — SES keeps retrying)* | — |
| Complaint | Complaint | EMAIL_COMPLAINT |
| anything else (Send, Reject, Open…) | unchanged | — |

Both identity notifications (`notificationType`) and configuration-set events (`eventType`)
are understood. Status changes only move forward (Sent < Delivered < Bounced < Complaint), so
duplicate or out-of-order notifications are harmless. Events for unknown message IDs are logged
(`ses_webhook.event` / `ses_event.unknown_message`) and ignored. **Application status is never
changed by delivery events** ([ADR-004](../decisions/adr-004-separate-application-and-email-status.md)).

## Security

- RSA signature verification (SignatureVersion 1 = SHA1, 2 = SHA256) against the certificate at
  `SigningCertURL`, which must be `https://sns.<region>.amazonaws.com/….pem`.
- `SubscribeURL` must also be an SNS host.
- Optional topic allow-list via `SES_SNS_TOPIC_ARN` (recommended).
- 256 KB body limit. Invalid messages → 400/403.

## Testing

- Send to `success@simulator.amazonses.com` → status becomes **Delivered**.
- `bounce@simulator.amazonses.com` → **Bounced**; `complaint@simulator.amazonses.com` → **Complaint**.
- Unit tests: `tests/unit/query-and-analytics.test.ts` (string-to-sign, trusted URLs, parsing).
- Integration: `tests/integration/email-service.test.ts` (status precedence, timeline, no
  application-status change).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Subscription stays *Pending confirmation* | Endpoint reachable over HTTPS? Server logs show `ses_webhook.*`? Raw delivery off? Reverse proxy passing the body unchanged? |
| 403 "Invalid signature" | Body modified by a proxy, or not an SNS request |
| 403 "Unexpected topic" | `SES_SNS_TOPIC_ARN` doesn't match the subscribed topic |
| Emails stay *Sent* | `SES_CONFIGURATION_SET` set? Event destination enabled with the right event types? |
| `unknown-message` results | Event for an email sent by another app/environment using the same topic |
