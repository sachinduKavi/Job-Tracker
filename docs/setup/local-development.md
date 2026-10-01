# Local Development (from zero)

Follow these steps in order on a fresh machine. Commands are for bash/zsh; PowerShell
differences are noted.

## 1. Required software

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | **20.9 or newer** (developed on 22.x) | `node -v` |
| npm | 10+ | `npm -v` |
| Git | any recent | `git --version` |
| Docker Desktop | recent (for the bundled MySQL) — *or* an existing MySQL 8 server | `docker --version` |

## 2. Get the code and install dependencies

```bash
git clone <repo-url> job-tracker
cd job-tracker
npm install
```

`npm install` runs `prisma generate` automatically (`postinstall`), creating the typed client
in `lib/generated/prisma/` (gitignored).

## 3. Create the MySQL database

**Option A — Docker (recommended):**

```bash
docker compose up -d
docker compose ps        # wait until jobtrack-mysql is "healthy"
```

This starts MySQL 8.0 on **localhost:3307** with:
- database `jobtrack` (development), user `jobtrack` / password `jobtrack`
- database `jobtrack_test` (used by automated tests)
- the `jobtrack` user may create databases (needed for Prisma's shadow database)

**Option B — existing MySQL 8 server:** see [database-setup.md](database-setup.md#option-b--existing-mysql-server).

## 4. Configure `.env`

```bash
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="mysql://jobtrack:jobtrack@localhost:3307/jobtrack"
APP_PASSWORD="choose-a-password"
SESSION_SECRET="<output of the command below>"
EMAIL_TRANSPORT="mock"        # no AWS needed yet
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

All variables: [environment-variables.md](environment-variables.md).

## 5. Run Prisma migrations

```bash
npx prisma migrate dev
```

Creates all tables in `jobtrack` from `prisma/migrations/`. (In development `migrate dev`
also checks the schema for drift using a temporary shadow database.)

## 6. Generate the Prisma client

```bash
npx prisma generate
```

Already done by `npm install`; run it again whenever `prisma/schema.prisma` changes.

## 7. Seed data

```bash
npx prisma db seed
```

Adds two email templates, a sample profile and six sample applications (only if there are
no applications yet). Safe to run repeatedly.

## 8. Start the development server

```bash
npm run dev
```

Open <http://localhost:3000>, sign in with `APP_PASSWORD`. You should see the dashboard with
the seeded applications.

## 9. Test email functionality

**Without AWS** (`EMAIL_TRANSPORT="mock"`):
1. Documents → *Upload document* → upload any PDF as a CV.
2. Open an application → *Send email* → fill To/Subject/Body → *Review & send* → *Send Application*.
3. The details page shows status **Applied**, delivery status **Sent** and an SES Message ID
   starting with `mock-`. Nothing leaves your machine.

**With SES** (`EMAIL_TRANSPORT="ses"`): complete [aws-setup.md](aws-setup.md), set
`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`, restart
`npm run dev`, and send to an address you control (in the SES sandbox it must be verified).
Check Settings → *Email (Amazon SES)* for configuration status.

## 10. Run the tests

```bash
npm run test:unit
npm run test:integration   # needs Docker MySQL (jobtrack_test)
npm run test:e2e           # first time: npx playwright install chromium
```

See [testing.md](../development/testing.md).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types + `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | `prisma db seed` |
| `npm run db:studio` | Prisma Studio (browse data) |
| `docker compose down` | Stop MySQL (data kept in the `jobtrack-mysql-data` volume) |
| `docker compose down -v` | Stop MySQL **and delete all local data** |

Problems? [troubleshooting.md](../development/troubleshooting.md).
