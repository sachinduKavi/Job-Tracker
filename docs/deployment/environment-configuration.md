# Environment Configuration

## Environments

| | Development | Test (automated) | Production |
| --- | --- | --- | --- |
| Command | `npm run dev` | Vitest / Playwright | `npm start` |
| `NODE_ENV` | development | test (Vitest) / development (Playwright server) | production |
| Env source | `.env` | `.env.test` (committed, local values) | secret store / `EnvironmentFile` |
| Database | Docker `jobtrack` (3307) | Docker `jobtrack_test` — wiped by tests | managed MySQL, app user |
| `EMAIL_TRANSPORT` | `mock` or `ses` (sandbox) | `mock` | `ses` |
| AWS credentials | IAM user keys in `.env` | none | IAM role |
| Cookies | not `Secure` | not `Secure` | `Secure` (HTTPS required) |
| Migrations | `prisma migrate dev` | `prisma migrate deploy` (setup) | `prisma migrate deploy` (release step) |

A staging environment, if used, mirrors production with its own database, `SESSION_SECRET`
and SES configuration set; send only to verified or simulator addresses.

## Production values

| Variable | Production guidance |
| --- | --- |
| `DATABASE_URL` | runtime app user (DML only), TLS if supported by the host |
| `APP_PASSWORD` | long unique passphrase, from a password manager |
| `SESSION_SECRET` | 48+ random bytes, unique to production |
| `AWS_REGION` | region with your verified domain and production access |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **unset** (IAM role) |
| `SES_FROM_EMAIL` / `SES_FROM_NAME` / `SES_REPLY_TO` | verified domain address |
| `SES_CONFIGURATION_SET` | `jobtrack` (delivery tracking) |
| `SES_SNS_TOPIC_ARN` | the subscribed topic ARN |
| `EMAIL_TRANSPORT` | `ses` |
| `EMAIL_RATE_LIMIT_PER_HOUR` | e.g. `20` |
| `STORAGE_DIR` | absolute path on a persistent, backed-up volume |
| `PORT` | as required by the proxy (default 3000) |

## Handling secrets

- Store secrets in AWS Secrets Manager / SSM Parameter Store, your PaaS secret manager, or a
  root-owned `chmod 600` env file — never in Git, Docker images or logs.
- Rotate: `SESSION_SECRET` (logs everyone out), `APP_PASSWORD`, DB password, AWS keys (if any).
- Configuration is validated at first use; a missing/invalid variable produces
  `Invalid server environment configuration: <NAME>: <reason>` (names only, never values).

## Changing configuration

Environment variables are read at process start (and cached). After changing them, restart
the app. No rebuild is needed (nothing is inlined at build time).
