# Decision

ADR-002: Use MySQL 8 with Prisma ORM (v7, MariaDB driver adapter).

Status: Accepted · Date: 2026-10-01 · Supersedes the specification's original PostgreSQL choice.

## Context

The data is relational: applications have emails, documents, status history and events, with
clear foreign keys and cascade rules. The specification initially named PostgreSQL; the project
owner already operates a MySQL 8 server and asked to use MySQL instead.

## Problem

Which database and data-access layer give type safety, migrations and simple operations for
this project?

## Options Considered

1. **MySQL 8 + Prisma**
2. PostgreSQL + Prisma (original spec)
3. MySQL + Drizzle ORM / Kysely
4. Raw SQL (`mysql2`)

## Decision

MySQL 8 (InnoDB, utf8mb4) accessed through Prisma 7. Prisma 7 requires a driver adapter; we use
`@prisma/adapter-mariadb`, which speaks the MySQL protocol. Connection setup lives in
`lib/prisma-client.ts`; the app uses the singleton in `lib/db.ts`.

## Reasons

- Existing MySQL infrastructure and knowledge; managed options everywhere (RDS, Aurora).
- Prisma: generated types for every query, declarative schema, versioned SQL migrations,
  transactions, seed tooling, Prisma Studio.
- Relational integrity (foreign keys, unique constraints) fits the domain.

## Consequences

MySQL-specific design choices:

- **No array columns** in Prisma/MySQL → the tech stack is a normalised `ApplicationTechnology`
  table (also better for analytics; see ADR-005); CC/BCC lists are comma-separated text.
- **No `mode: "insensitive"`** → case-insensitive search relies on the `utf8mb4_unicode_ci`
  collation Prisma uses for tables.
- `String` maps to `VARCHAR(191)` → long fields use `@db.Text` / `@db.MediumText`; lengths are
  set explicitly and mirrored in Zod limits.
- DDL is not transactional in MySQL → a failed migration can be partially applied (handled in
  [rollback.md](../deployment/rollback.md)).
- `prisma migrate dev` needs a shadow database (`CREATE DATABASE` privilege or `SHADOW_DATABASE_URL`).
- Prisma 7 generates the client into `lib/generated/prisma` (gitignored, regenerated on install).

## Future Considerations

Multi-tenancy will add `userId` columns and composite indexes. If full-text search becomes
important, add MySQL `FULLTEXT` indexes via a raw migration or an external search service.
