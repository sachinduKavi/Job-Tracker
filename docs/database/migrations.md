# Migrations

Prisma Migrate manages the schema. Migration SQL lives in `prisma/migrations/<timestamp>_<name>/migration.sql`
and is committed to Git. Configuration is in `prisma.config.ts` (schema path, migrations path,
seed command, datasource URL from `DATABASE_URL`, optional `SHADOW_DATABASE_URL`).

## Commands

```bash
npx prisma migrate dev               # dev: create/apply migrations, detect drift (uses a shadow DB)
npx prisma migrate dev --name <name> # dev: create a new migration after editing schema.prisma
npx prisma generate                  # regenerate the client into lib/generated/prisma
npx prisma db seed                   # run prisma/seed.ts
npx prisma migrate deploy            # staging/production: apply pending migrations only
npx prisma migrate status            # show applied / pending migrations
npx prisma migrate reset             # dev only: drop, re-apply all migrations, seed — DESTROYS DATA
```

npm shortcuts: `npm run db:migrate`, `npm run db:deploy`, `npm run db:seed`, `npm run db:studio`.

## Development vs production

| | `migrate dev` | `migrate deploy` |
| --- | --- | --- |
| Where | your machine | CI/CD, staging, production, any shared DB |
| Creates new migrations | yes | never |
| Needs a shadow database | yes (`CREATE DATABASE` privilege or `SHADOW_DATABASE_URL`) | no |
| May reset the database on drift | yes (asks first) | never |
| Runs seed | on reset | never |

Never run `migrate dev` or `migrate reset` against production.

## Workflow for a schema change

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name describe_the_change` (against the local Docker DB).
3. Review the generated SQL — especially `DROP`, column type changes and new `NOT NULL`
   columns on populated tables (add a default or a two-step migration).
4. `npx prisma generate` (done automatically by `migrate dev`), fix types, run tests.
5. Update [schema.md](schema.md), [relationships.md](relationships.md) if FKs changed, and add an
   entry to the history below and to [changelog.md](../development/changelog.md).
6. Commit schema + migration folder together.
7. Deploy: `npx prisma migrate deploy` runs before the new code starts
   ([deployment/production.md](../deployment/production.md#database-migration)).

## Seeding

`prisma/seed.ts` (run with `tsx`) is idempotent:
- upserts the "General application" and "Internship application" templates by name,
- creates the default profile if missing,
- creates six sample applications **only if the Application table is empty**.

It uses `lib/prisma-client.ts` directly (not `lib/db.ts`, which is `server-only`).
Do not seed production unless you want sample data there.

## Migration history

### `20261001151350_init` — 2026-10-01

**What:** initial schema — `Application`, `ApplicationTechnology`, `Email`, `EmailAttachment`,
`Document`, `ApplicationDocument`, `StatusHistory`, `EmailTemplate`, `ApplicationEvent`,
`Profile`, `Counter`; all enums; indexes and foreign keys as in [schema.md](schema.md).

**Why:** first version of JobTrack (phases 1–6). Deviations from the specification's model
list (tech stack table, document library with link table, attachment snapshots, profile and
counter tables) are explained in [ADR-005](../decisions/adr-005-normalised-tech-stack-and-document-library.md).

## Troubleshooting

See [troubleshooting.md](../development/troubleshooting.md#database) — "Prisma migration failed",
"Prisma client outdated", shadow database permission errors.
