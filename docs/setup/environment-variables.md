# Environment Variables

Server configuration is parsed and validated by `lib/env.ts` (Zod) on first use; an invalid
configuration fails with a message naming the variable (never its value). Copy
[`.env.example`](../../.env.example) to `.env` for local development. `.env` is gitignored.

> No variable is exposed to the browser (there are no `NEXT_PUBLIC_*` variables).

## Database

| Variable | Purpose | Required | Example | Security considerations |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | MySQL connection URL used by the app, Prisma CLI and seed | **Yes** | `mysql://jobtrack:jobtrack@localhost:3307/jobtrack` | Contains a password. Use a least-privilege DB user; URL-encode special characters; use TLS for remote servers. |
| `SHADOW_DATABASE_URL` | Shadow DB for `prisma migrate dev` when the user cannot `CREATE DATABASE` | No | `mysql://user:pass@host:3306/jobtrack_shadow` | Development only. Must be an empty, disposable database — Prisma drops its contents. |

## Authentication

| Variable | Purpose | Required | Example | Security considerations |
| --- | --- | --- | --- | --- |
| `APP_PASSWORD` | Password for the single JobTrack user (min 8 chars) | **Yes** | `a-long-unique-passphrase` | Use a long, unique passphrase; changing it does not log out existing sessions (rotate `SESSION_SECRET` for that). |
| `SESSION_SECRET` | HMAC key for session cookies (min 32 chars) | **Yes** | output of `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | Anyone with it can forge sessions. Rotate to log everyone out. Different value per environment. |

## Amazon SES

| Variable | Purpose | Required | Example | Security considerations |
| --- | --- | --- | --- | --- |
| `AWS_REGION` | SES region (identities are per region) | Yes for SES (default `us-east-1`) | `us-east-1` | — |
| `AWS_ACCESS_KEY_ID` | IAM access key (read by the AWS SDK) | Only if no IAM role | `AKIA…` | Server-only. Least-privilege IAM user ([iam.md](../aws/iam.md)). Prefer an IAM role in production. Rotate regularly; never log. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | Only if no IAM role | `wJalr…` | As above. If leaked: deactivate the key in IAM immediately. |
| `SES_FROM_EMAIL` | Verified sender address | Yes to send real email | `you@yourdomain.com` | Must be verified in SES in `AWS_REGION`. |
| `SES_FROM_NAME` | Display name for the From header | No | `Sachindu Kavishka` | — |
| `SES_REPLY_TO` | Reply-To address | No | `you@gmail.com` | — |
| `SES_CONFIGURATION_SET` | SES configuration set for event publishing (delivery tracking) | No (needed for tracking) | `jobtrack` | Must exist in the region or sends fail with `NotFoundException`. |
| `SES_SNS_TOPIC_ARN` | Only accept webhook notifications from this topic | No (recommended in production) | `arn:aws:sns:us-east-1:123456789012:jobtrack-ses-events` | Defence in depth on top of SNS signature verification. |

## Email behaviour

| Variable | Purpose | Required | Example | Security considerations |
| --- | --- | --- | --- | --- |
| `EMAIL_TRANSPORT` | `ses` sends real email; `mock` uses an in-memory outbox | No (default `ses`) | `mock` | `mock` is rejected when `NODE_ENV=production`. |
| `EMAIL_RATE_LIMIT_PER_HOUR` | Max emails per rolling hour (failed sends excluded) | No (default `20`) | `20` | Protects your sender reputation if something goes wrong. |

## Storage

| Variable | Purpose | Required | Example | Security considerations |
| --- | --- | --- | --- | --- |
| `STORAGE_DIR` | Directory for uploaded documents (relative to the project root or absolute) | No (default `./storage/uploads`) | `/var/lib/jobtrack/uploads` | Must not be inside `public/`. Back it up together with the database. Restrict filesystem permissions to the app user. |

## Set by the platform

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `development` for `next dev`, `production` for `next build`/`next start`, `test` in Vitest. |
| `PORT` | Port for `next start` (default 3000). |

## Test configuration

`.env.test` (committed) holds **local Docker-only** values used by Vitest and Playwright:
the `jobtrack_test` database, a fixed test password and `EMAIL_TRANSPORT="mock"`. The test
tooling refuses to run unless `DATABASE_URL` points at a database whose name ends in `_test`.
