# JobTrack

Job application tracking and email management platform.

JobTrack keeps every job application, its status history, the email you sent (through
Amazon SES, with your CV attached) and the email's delivery status in one place, with
search, filtering and analytics on top.

> Start here, then follow the links into [`docs/`](docs/README.md) for depth.

---

## Features

- **Applications** — create, edit, delete; human-readable IDs (`APP-0001`); company, position,
  tech stack, location, source, job URL, notes, draft email.
- **Dashboard & table** — search (company, position, tech stack, location, ID), filters
  (status, source, company, position, location, date range), sorting, pagination — all in the URL.
- **Status tracking** — 10 statuses with a validated lifecycle, status history and a full timeline.
- **Email sending through Amazon SES** — composer with templates, HTML + plain-text bodies,
  CV/cover-letter attachments, preview, mandatory confirmation, duplicate-send prevention and
  rate limiting. A successful send stores the SES Message ID and moves `Draft → Applied`.
- **Delivery tracking** — `Sent / Delivered / Bounced / Complaint` via SES → SNS webhook,
  kept separate from the application status ([ADR-004](docs/decisions/adr-004-separate-application-and-email-status.md)).
- **Email templates** — `{{company}} {{position}} {{name}} {{email}} {{phone}} {{location}}` with live preview.
- **Document library** — multiple CVs, cover letters and other files; default per type; rename/delete;
  magic-byte validation; 5 MB limit.
- **Analytics** — headline metrics and charts by status, time, source, technology and location.
- **SaaS-style UI** — shadcn/ui, responsive, dark/light mode, toasts, dialogs, skeleton/empty/error states.
- **Security** — single-user login, server-only AWS credentials, Zod validation on client and
  server, HTML sanitization, protected Server Actions ([security](docs/architecture/security.md)).

## Architecture

```text
Browser ──► Next.js (App Router)
              ├── UI: Server Components + Client Components (components/)
              ├── Server Actions (app/actions/)  &  Route Handlers (app/api/)
              ├── Business logic / services (lib/)  ← the only layer that touches Prisma / AWS
              ├── Prisma 7 + MariaDB driver adapter ──► MySQL 8
              └── AWS SDK v3 (SESv2) ──► Amazon SES ──► Employer
                                         └─► SNS ──► /api/webhooks/ses (delivery events)
```

Read [architecture/overview.md](docs/architecture/overview.md) for the full picture and
[decisions/](docs/decisions/) for the reasoning.

## Tech Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
shadcn/ui (Radix) · Lucide · React Hook Form · Zod 4 · Prisma 7 · MySQL 8 ·
AWS SDK v3 (`@aws-sdk/client-sesv2`) · Recharts · Vitest · Playwright.

## Project Structure

```text
app/
  (app)/                 Authenticated pages (dashboard, applications, templates, documents, analytics, settings)
  actions/               Server Actions — authenticate → validate → call lib/ → revalidate
  api/                   Route Handlers (document download, SES webhook, health)
  login/                 Sign-in page
components/              UI components (ui/ = shadcn primitives)
lib/                     Server-side business logic and shared pure modules
  applications/          status config, IDs, query parsing, schemas, service
  email/                 SES client (ses.ts), send flow, payload, sanitization, SNS parsing
  documents/ storage/    document validation, library service, local file storage
  templates/ analytics/ profile/ auth/ validation/
prisma/                  schema.prisma, migrations/, seed.ts
tests/                   unit/, integration/, e2e/, support/
docs/                    All project documentation
proxy.ts                 Auth gate (Next.js 16 "proxy", formerly middleware)
```

Details: [architecture/application-architecture.md](docs/architecture/application-architecture.md).

## Prerequisites

- Node.js **20.9+** (developed on 22.x) and npm 10+
- MySQL **8.0** — or Docker Desktop to run the bundled `docker-compose.yml`
- An AWS account with Amazon SES (only needed to send real email)

## Installation

```bash
git clone <repo-url> job-tracker
cd job-tracker
npm install            # also runs `prisma generate` (postinstall)
cp .env.example .env   # then edit .env
```

## Environment Variables

All variables are listed in [`.env.example`](.env.example) and documented (purpose, required,
example, security notes) in [setup/environment-variables.md](docs/setup/environment-variables.md).
Minimum to run locally: `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`.

## Database Setup

```bash
docker compose up -d          # local MySQL 8 on port 3307 (+ jobtrack_test database)
npx prisma migrate dev        # apply migrations (development)
npx prisma generate           # regenerate the client (also done by npm install)
npx prisma db seed            # sample templates, profile and applications
```

See [setup/database-setup.md](docs/setup/database-setup.md) and [database/](docs/database/schema.md).

## AWS SES Setup

1. Verify a sender identity in SES (email or domain).
2. Create an IAM user/role with only `ses:SendEmail` + `ses:SendRawEmail` ([aws/iam.md](docs/aws/iam.md)).
3. Set `AWS_REGION`, `SES_FROM_EMAIL` and credentials in `.env`.
4. In the SES sandbox, recipients must also be verified — request production access to email employers.
5. Optional: delivery tracking via a configuration set + SNS ([aws/email-events.md](docs/aws/email-events.md)).

Step-by-step: [setup/aws-setup.md](docs/setup/aws-setup.md) and [aws/ses.md](docs/aws/ses.md).
For local work without AWS set `EMAIL_TRANSPORT="mock"`.

## Running Locally

```bash
npm run dev            # http://localhost:3000 — sign in with APP_PASSWORD
```

Full walkthrough from zero: [setup/local-development.md](docs/setup/local-development.md).

## Testing

```bash
docker compose up -d   # tests use the jobtrack_test database from .env.test
npm run test:unit      # pure logic (no I/O)
npm run test:integration
npm run test:e2e       # Playwright: create → select CV → compose → preview → confirm → send → Applied
npm test               # unit + integration
```

See [development/testing.md](docs/development/testing.md).

## Deployment

`npm ci && npx prisma migrate deploy && npm run build && npm start` behind HTTPS, with
secrets from your platform's secret store and an IAM role for SES.
See [deployment/production.md](docs/deployment/production.md) and [deployment/rollback.md](docs/deployment/rollback.md).

## Documentation

| Area | Start with |
| --- | --- |
| Index | [docs/README.md](docs/README.md) |
| Architecture | [overview](docs/architecture/overview.md) · [application](docs/architecture/application-architecture.md) · [data flow](docs/architecture/data-flow.md) · [email flow](docs/architecture/email-flow.md) · [security](docs/architecture/security.md) · [future](docs/architecture/future-architecture.md) |
| Setup | [local development](docs/setup/local-development.md) · [environment variables](docs/setup/environment-variables.md) · [database](docs/setup/database-setup.md) · [AWS](docs/setup/aws-setup.md) |
| Database | [schema](docs/database/schema.md) · [relationships](docs/database/relationships.md) · [migrations](docs/database/migrations.md) |
| Features | [applications](docs/features/applications.md) · [status tracking](docs/features/status-tracking.md) · [email sending](docs/features/email-sending.md) · [templates](docs/features/email-templates.md) · [documents](docs/features/documents.md) · [analytics](docs/features/analytics.md) |
| AWS | [SES](docs/aws/ses.md) · [IAM](docs/aws/iam.md) · [email events](docs/aws/email-events.md) |
| Development | [coding guidelines](docs/development/coding-guidelines.md) · [git workflow](docs/development/git-workflow.md) · [testing](docs/development/testing.md) · [troubleshooting](docs/development/troubleshooting.md) · [changelog](docs/development/changelog.md) |
| Deployment | [production](docs/deployment/production.md) · [environment configuration](docs/deployment/environment-configuration.md) · [rollback](docs/deployment/rollback.md) |
| Decisions | [ADRs](docs/decisions/) |

## Contributing

1. Branch from `main` using the [naming convention](docs/development/git-workflow.md) (`feature/…`, `fix/…`).
2. Follow the [coding guidelines](docs/development/coding-guidelines.md): business logic in `lib/`, never in components.
3. Add or update tests; `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` must pass.
4. Update the relevant docs and add an entry to [changelog.md](docs/development/changelog.md).
5. Open a pull request using Conventional Commit style titles.

## License

Private project — all rights reserved. No license is granted for redistribution.
