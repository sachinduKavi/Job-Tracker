# Database Setup

JobTrack uses **MySQL 8.0** through Prisma 7 with the `@prisma/adapter-mariadb` driver
adapter (wire-compatible with MySQL). Tables use InnoDB and `utf8mb4` with the
case-insensitive `utf8mb4_unicode_ci` collation, which is what makes search case-insensitive.

## Option A — Docker (local development)

```bash
docker compose up -d
```

`docker-compose.yml` starts `mysql:8.0` as `jobtrack-mysql`:

| Setting | Value |
| --- | --- |
| Host / port | `localhost:3307` |
| Dev database | `jobtrack` |
| Test database | `jobtrack_test` (created by `docker/mysql-init/01-test-db.sql`) |
| App user / password | `jobtrack` / `jobtrack` (may create databases — needed for the shadow DB) |
| Root password | `jobtrack_root` |
| Data volume | `jobtrack-mysql-data` |

The init script runs only on the **first** start of an empty volume. To start over:
`docker compose down -v && docker compose up -d`.

These credentials are for local use only — never reuse them anywhere else.

## Option B — existing MySQL server

1. Create the database and a dedicated user (run as an admin):

   ```sql
   CREATE DATABASE jobtrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'jobtrack_app'@'%' IDENTIFIED BY '<strong-password>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
     ON jobtrack.* TO 'jobtrack_app'@'%';
   ```

   In production you can split this into a migration user (DDL) and a runtime user
   (`SELECT, INSERT, UPDATE, DELETE` only) — see [deployment/production.md](../deployment/production.md#database).

2. `prisma migrate dev` needs a **shadow database**. Either grant `CREATE, DROP ON *.*` to the
   user, or create an empty database (e.g. `jobtrack_shadow`) and set `SHADOW_DATABASE_URL`.
   `prisma migrate deploy` (production) does not need a shadow database.

3. Set `DATABASE_URL="mysql://jobtrack_app:<url-encoded-password>@host:3306/jobtrack"`.

> **Shared servers:** avoid giving JobTrack an account with server-wide privileges
> (e.g. `GRANT ALL ON *.*`). A mistake in a migration should only ever be able to touch the
> JobTrack database.

## Create the schema

```bash
npx prisma migrate dev     # development: apply + check for drift
# or
npx prisma migrate deploy  # any shared/production database: apply pending migrations only
npx prisma db seed         # optional sample data (development)
```

## Verify

```bash
npx prisma migrate status
curl http://localhost:3000/api/health   # {"status":"ok","database":"ok",...}
```

## Inspect data

```bash
npx prisma studio   # web UI at http://localhost:5555
```

## Connection details

`lib/prisma-client.ts` parses `DATABASE_URL` and creates the adapter with a pool of 5
connections, a 10 s connect timeout and `allowPublicKeyRetrieval` (required for MySQL 8's
`caching_sha2_password` over non-TLS connections).

Next: [schema.md](../database/schema.md), [migrations.md](../database/migrations.md).
