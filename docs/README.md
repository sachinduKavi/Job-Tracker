# JobTrack Documentation

Documentation is part of the product. Every page describes what is **implemented today**;
if you change the code, update the matching page and add an entry to the
[development changelog](development/changelog.md).

## How to navigate

| I want to… | Read |
| --- | --- |
| Understand the system | [architecture/overview.md](architecture/overview.md) |
| Run it on my machine | [setup/local-development.md](setup/local-development.md) |
| Configure environment variables | [setup/environment-variables.md](setup/environment-variables.md) |
| Configure Amazon SES | [setup/aws-setup.md](setup/aws-setup.md) → [aws/ses.md](aws/ses.md) |
| Change the database | [database/migrations.md](database/migrations.md) |
| Deploy | [deployment/production.md](deployment/production.md) |
| Fix something | [development/troubleshooting.md](development/troubleshooting.md) |
| Know why something is the way it is | [decisions/](#decisions-adrs) |

## Contents

### Requirements
- [specification.md](specification.md) — the original product & engineering specification

### Architecture
- [overview.md](architecture/overview.md) — system diagram, why Next.js full-stack, how it can evolve
- [application-architecture.md](architecture/application-architecture.md) — layers, folders, server/client boundary
- [data-flow.md](architecture/data-flow.md) — reads, mutations, revalidation, URL state
- [email-flow.md](architecture/email-flow.md) — compose → send → SES → delivery events
- [security.md](architecture/security.md) — every security decision
- [future-architecture.md](architecture/future-architecture.md) — path to a separate API / SaaS

### Setup
- [local-development.md](setup/local-development.md) — zero to running app
- [environment-variables.md](setup/environment-variables.md) — every variable
- [database-setup.md](setup/database-setup.md) — MySQL (Docker or existing server)
- [aws-setup.md](setup/aws-setup.md) — AWS account → IAM → SES → env vars

### Database
- [schema.md](database/schema.md) — tables, columns, types, indexes
- [relationships.md](database/relationships.md) — foreign keys and cascade rules
- [migrations.md](database/migrations.md) — dev vs production migrations, seeding, history

### Features
- [applications.md](features/applications.md) — CRUD, dashboard table, search/filter/sort, IDs, timeline
- [status-tracking.md](features/status-tracking.md) — statuses and lifecycle
- [email-sending.md](features/email-sending.md) — composer, SES send flow, delivery tracking
- [email-templates.md](features/email-templates.md) — templates and variables
- [documents.md](features/documents.md) — CV & document library, uploads, storage
- [analytics.md](features/analytics.md) — metric definitions and charts

### AWS
- [ses.md](aws/ses.md) — SES configuration, sandbox, testing, troubleshooting
- [iam.md](aws/iam.md) — least-privilege policies
- [email-events.md](aws/email-events.md) — delivery tracking with configuration sets + SNS

### Development
- [coding-guidelines.md](development/coding-guidelines.md)
- [git-workflow.md](development/git-workflow.md)
- [testing.md](development/testing.md)
- [troubleshooting.md](development/troubleshooting.md)
- [changelog.md](development/changelog.md) — development log

### Deployment
- [production.md](deployment/production.md)
- [environment-configuration.md](deployment/environment-configuration.md)
- [rollback.md](deployment/rollback.md)

### Decisions (ADRs)
- [ADR-001 Next.js full-stack instead of NestJS](decisions/adr-001-nextjs-fullstack.md)
- [ADR-002 MySQL + Prisma](decisions/adr-002-mysql-prisma.md)
- [ADR-003 Amazon SES for email](decisions/adr-003-amazon-ses.md)
- [ADR-004 Application status ≠ email delivery status](decisions/adr-004-separate-application-and-email-status.md)
- [ADR-005 Normalised tech stack and document library](decisions/adr-005-normalised-tech-stack-and-document-library.md)
- [ADR-006 Single-user password authentication](decisions/adr-006-single-user-authentication.md)
- [ADR-007 Local filesystem document storage](decisions/adr-007-local-document-storage.md)

## Documentation rules

1. Implement the feature, then document how it works, why, configuration, testing and common failures.
2. Feature pages follow the template: Purpose · User Flow · Architecture · Implementation ·
   Database Changes · Server Actions / API · Validation · Security · Testing · Error Handling ·
   Known Limitations · Future Improvements.
3. Never document functionality that does not exist. Mark planned work as *future*.
4. Significant decisions get an ADR (`decisions/adr-NNN-*.md`).
5. Every schema change updates [database/schema.md](database/schema.md) and [database/migrations.md](database/migrations.md).
