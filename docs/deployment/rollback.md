# Rollback

## Before every release

1. **Database snapshot** (RDS: *Take snapshot*; self-hosted:
   `mysqldump --single-transaction --routines jobtrack > jobtrack-$(date +%F).sql`).
2. **Storage backup** of `STORAGE_DIR` (snapshot or `rsync`/`aws s3 sync`).
3. Note the currently deployed Git tag (e.g. `v1.3.0`).
4. Review pending migrations: `npx prisma migrate status` and read their SQL. Prefer
   **backwards-compatible** (expand → migrate → contract) migrations so the previous app version
   still works on the new schema.

## Application rollback (no schema change involved)

```bash
git checkout v1.3.0          # previous tag
npm ci && npm run build
# restart the service (systemctl restart jobtrack / redeploy previous image)
curl https://<domain>/api/health
```

With containers: redeploy the previous image tag. With a PaaS: "redeploy previous release".

## Rollback when the release included a migration

Prisma has no automatic down-migrations. Options, safest first:

1. **Schema is backwards compatible** (only added tables/nullable columns): roll back the app
   only (above). Leave the schema; the next release can use it.
2. **Write a corrective migration** (forward fix): revert the schema change in
   `schema.prisma`, `npx prisma migrate dev --name revert_<change>` locally, review the SQL, release
   it with `migrate deploy`. Keeps history linear and auditable.
3. **Restore the snapshot** (data written since the snapshot is lost):
   - stop the app;
   - restore the database snapshot (RDS: restore to a new instance and switch `DATABASE_URL`; or
     `mysql jobtrack < jobtrack-YYYY-MM-DD.sql` into an emptied database);
   - deploy the previous app version;
   - verify `npx prisma migrate status` shows the previous migration set as applied.

## A migration failed half-way

`prisma migrate deploy` stops and marks the migration as failed (`P3009` on the next run).

1. Inspect what was applied (MySQL DDL is not transactional — some statements may have run).
2. Either complete the remaining statements manually and run
   `npx prisma migrate resolve --applied <migration_name>`, **or** undo the partial changes
   manually and run `npx prisma migrate resolve --rolled-back <migration_name>`.
3. Fix the migration (in a new commit) and `migrate deploy` again.

## Storage rollback

Documents are only added/removed by users, never by releases, so storage normally needs no
rollback. If a release corrupted files, restore `STORAGE_DIR` from backup; database rows reference
files by `storageKey`, so restore both from the same point in time when possible.

## After a rollback

- Confirm `/api/health`, sign in, open an application and the composer.
- Check logs for `action.*.error` and `email.*` events.
- Record what happened in [changelog.md](../development/changelog.md).
