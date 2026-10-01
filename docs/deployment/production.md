# Production Deployment

JobTrack is a standard Node.js Next.js server (`next start`) plus a MySQL database, a persistent
directory for uploaded documents, and Amazon SES. It stores files on local disk
([ADR-007](../decisions/adr-007-local-document-storage.md)), so run it on a host with a
**persistent volume** — a VM (EC2, Lightsail, a VPS), a container with a mounted volume (ECS + EFS,
Docker on a VM) or a PaaS with persistent disks. Serverless platforms with ephemeral filesystems
(e.g. Vercel) are not suitable until documents move to S3.

## Overview

```text
Internet ─HTTPS─► Reverse proxy (Caddy / Nginx / ALB) ─HTTP─► next start :3000
                                                           ├─► MySQL 8 (managed: RDS/Aurora or self-hosted)
                                                           ├─► STORAGE_DIR (persistent volume)
                                                           └─► Amazon SES (IAM role)
SNS ─HTTPS─► /api/webhooks/ses
```

## Build process

```bash
npm ci                    # clean install from package-lock.json (runs prisma generate)
npm run lint && npm run typecheck && npm test   # in CI
npm run build             # next build (Turbopack) → .next/
```

Build-time requirements: Node 20.9+. The build does not connect to the database or AWS
(pages are dynamic; `lib/db.ts` connects lazily).

Run: `npm start` (`next start`, port `PORT` or 3000) under a process manager (systemd, PM2,
Docker `restart: unless-stopped`).

Example systemd unit:

```ini
[Unit]
Description=JobTrack
After=network.target

[Service]
WorkingDirectory=/opt/jobtrack
EnvironmentFile=/etc/jobtrack/env        # chmod 600, owned by root
ExecStart=/usr/bin/npm start
User=jobtrack
Restart=always

[Install]
WantedBy=multi-user.target
```

## Environment variables

Set every required variable from [environment-variables.md](../setup/environment-variables.md)
in the platform's secret store / `EnvironmentFile` — never in the repository or image. Production
specifics are in [environment-configuration.md](environment-configuration.md).

## Database

- Managed MySQL 8 (Amazon RDS/Aurora MySQL, or equivalent) with automated backups and
  point-in-time recovery, TLS in transit, not publicly accessible (security group only from the app).
- Two users recommended:
  - **migrator**: `CREATE, ALTER, DROP, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE` on the
    JobTrack schema — used only by `prisma migrate deploy`.
  - **app**: `SELECT, INSERT, UPDATE, DELETE` on the JobTrack schema — the runtime `DATABASE_URL`.
- Never grant server-wide privileges (`*.*`) to either user.

### Database migration

Run before starting the new version (CI/CD step or release command):

```bash
DATABASE_URL="<migrator url>" npx prisma migrate deploy
```

`migrate deploy` only applies committed, pending migrations; it never creates or resets anything.
Take a snapshot first ([rollback.md](rollback.md#before-every-release)). Do **not** run
`prisma db seed` in production unless you want sample data.

## AWS configuration

1. SES in your region: verified **domain** with DKIM, custom MAIL FROM (SPF) and DMARC.
2. **Production access** granted (out of the sandbox) — [aws/ses.md](../aws/ses.md#moving-out-of-the-sandbox).
3. IAM **role** for the compute with the scoped send-only policy ([aws/iam.md](../aws/iam.md));
   leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` unset.
4. Configuration set `jobtrack` + SNS topic + HTTPS subscription to
   `https://<domain>/api/webhooks/ses` ([aws/email-events.md](../aws/email-events.md)); set
   `SES_CONFIGURATION_SET` and `SES_SNS_TOPIC_ARN`.

## SES production configuration

- `EMAIL_TRANSPORT=ses` (the default; `mock` is refused in production).
- `SES_FROM_EMAIL` at the verified domain, `SES_FROM_NAME`, optional `SES_REPLY_TO`.
- Keep `EMAIL_RATE_LIMIT_PER_HOUR` conservative (e.g. 20).
- Watch SES reputation metrics (bounce < 5 %, complaint < 0.1 %).

## Domain configuration

- DNS `A`/`AAAA` (or `CNAME`/alias to a load balancer) for e.g. `jobtrack.yourdomain.com`.
- SES DKIM CNAMEs, MAIL FROM MX/TXT, DMARC TXT on the sending domain.
- If the public host differs from what the app sees (proxy without `X-Forwarded-Host`), add it to
  `experimental.serverActions.allowedOrigins` in `next.config.ts`, otherwise Server Actions are
  rejected as cross-origin.

## HTTPS

Terminate TLS at the reverse proxy / load balancer:

- **Caddy** (automatic Let's Encrypt):

  ```text
  jobtrack.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }
  ```

- **Nginx**: certbot certificate, `proxy_pass http://127.0.0.1:3000;`,
  `proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
  `client_max_body_size 7m;` (uploads), HSTS header.
- **AWS ALB**: ACM certificate, HTTP→HTTPS redirect.

With `NODE_ENV=production` the session cookie is `Secure`, so the site must be served over HTTPS.

## Storage

Mount a persistent volume and set `STORAGE_DIR` (e.g. `/var/lib/jobtrack/uploads`), owned by
the app user, mode `700`. Include it in backups (snapshot or nightly sync to S3) together with
database backups.

## Logging

- The app writes JSON lines to stdout/stderr (`lib/logger.ts`) with secrets and email bodies
  redacted. Next.js request logs also go to stdout.
- Collect with your platform (journald → Vector/Fluent Bit, CloudWatch Logs agent, Docker logging
  driver). Useful events: `action.*.error`, `email.ses_failed`, `email.ses_sent`,
  `email.post_send_update_failed`, `ses_webhook.*`, `auth.login_failed`, `health.database_unreachable`.

## Monitoring

- **Uptime/readiness:** poll `GET /api/health` (200 `{"status":"ok"}`; 503 when the DB is unreachable).
- **Alerts:** log-based alerts on `email.ses_failed`, `email.post_send_update_failed`, repeated
  `auth.login_failed`; CloudWatch alarms on SES `Reputation.BounceRate` / `ComplaintRate`, RDS
  CPU/storage/connections; disk usage of `STORAGE_DIR`.
- **Backups:** verify restores periodically.

## Release checklist

1. CI green (lint, typecheck, unit, integration, E2E).
2. DB snapshot taken; storage backup current.
3. `npx prisma migrate deploy` succeeded.
4. Deploy and restart; `curl https://<domain>/api/health` → ok.
5. Smoke test: sign in, open an application, open the composer (no send needed).
6. Watch logs for 15 minutes. Problems → [rollback.md](rollback.md).
