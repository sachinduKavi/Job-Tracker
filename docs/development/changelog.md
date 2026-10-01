# Development Log

Newest first. One entry per major feature: Date · Feature · Problem · Implementation ·
Files Changed · Database Changes · Testing · Documentation Updated.

---

## 2026-10-01 — Phase 8: Production readiness

### Feature
Production configuration, deployment, monitoring and rollback documentation; health endpoint;
security headers.

### Problem
The app must be deployable and operable by someone other than the original developer.

### Implementation
`/api/health` (DB readiness), security headers and body-size limit in `next.config.ts`,
`mock` transport refused in production, `postinstall: prisma generate`, npm scripts for
migrations. Documented build, env, migrations, SES production, domain/HTTPS, logging,
monitoring and rollback.

### Files Changed
`app/api/health/route.ts`, `next.config.ts`, `lib/env.ts`, `package.json`, `docs/deployment/*`.

### Database Changes
None.

### Testing
`npm run build` succeeds; health endpoint verified against local MySQL.

### Documentation Updated
`docs/deployment/production.md`, `environment-configuration.md`, `rollback.md`, `README.md`.

---

## 2026-10-01 — Phase 7: Testing

### Feature
Unit, integration and end-to-end test suites.

### Problem
Critical logic (status rules, IDs, templates, email flow) and the send workflow need automated
protection against regressions.

### Implementation
Vitest projects `unit` and `integration` (real MySQL `jobtrack_test`, serial, reset per test,
`_test` database guard); Playwright E2E with `next dev` on port 3200 and the mock SES transport.
Test seams: `setSesClientForTesting`, `resetServerEnvForTesting`, `getMockOutbox`.
Bugs found and fixed by the tests:
- InnoDB deadlock when several applications were created concurrently before the counter row
  existed → counter row is now ensured outside the transaction.
- Toolbar race: a pending debounced search overwrote a status filter chosen right after
  "Clear" → debounce moved into the input handler and URL updates read the live location.

### Files Changed
`vitest.config.ts`, `playwright.config.ts`, `tests/**`, `.env.test`, `lib/applications/service.ts`,
`components/applications/applications-toolbar.tsx`.

### Database Changes
None.

### Testing
50 unit, 23 integration and 4 E2E tests passing.

### Documentation Updated
`docs/development/testing.md`, `docs/features/applications.md`.

---

## 2026-10-01 — Phase 6: Analytics

### Feature
Dashboard metrics and charts (status, time, source, technology, location, email delivery).

### Problem
Need to see progress and what works across many applications.

### Implementation
`lib/analytics/service.ts` (COUNT/GROUP BY in MySQL, parameterised raw query for the monthly
series), pure helpers in `aggregate.ts`, Recharts components with tooltips and table views,
single validated series colour for light/dark.

### Files Changed
`lib/analytics/*`, `components/analytics/*`, `app/(app)/analytics/page.tsx`, `app/(app)/page.tsx`, `app/globals.css`.

### Database Changes
None (uses existing indexes).

### Testing
Unit (series, top-N), integration (metrics against MySQL).

### Documentation Updated
`docs/features/analytics.md`.

---

## 2026-10-01 — Phase 5: Amazon SES

### Feature
Send application emails through SES with attachments; store Message ID; delivery tracking.

### Problem
Applications should be sent from JobTrack with an exact record of what was sent and whether it arrived.

### Implementation
`lib/email/ses.ts` (SESv2 `SendEmail`, Simple content with native attachments, error mapping,
mock transport), `payload.ts`, `sanitize.ts`, `service.ts` (rate limit, idempotency key,
in-flight and re-send guards, reserve → send → record, Draft → Applied), SNS webhook with
signature verification (`sns.ts`, `delivery-events.ts`, `app/api/webhooks/ses`).

### Files Changed
`lib/email/*`, `app/actions/email.ts`, `app/api/webhooks/ses/route.ts`.

### Database Changes
`Email` (sesMessageId unique, idempotencyKey unique, emailStatus enum), `EmailAttachment`.

### Testing
Unit (payload, sanitisation, error mapping, SNS parsing); integration with mock and fake SES
clients; E2E send flow.

### Documentation Updated
`docs/aws/ses.md`, `docs/aws/iam.md`, `docs/aws/email-events.md`, `docs/features/email-sending.md`,
`docs/architecture/email-flow.md`, ADR-003, ADR-004.

---

## 2026-10-01 — Phase 4: Email templates & composer

### Feature
Template CRUD with `{{variables}}`, live preview, profile values; email composer with template
selection, HTML/plain-text bodies, attachments, preview and confirmation dialog.

### Problem
Writing each application email from scratch is slow and error-prone.

### Implementation
`lib/templates/render.ts` (pure renderer reporting missing/unknown variables), template service
and actions, `components/templates/*`, `components/email/email-composer.tsx`,
`email-html-preview.tsx` (sandboxed iframe), profile settings.

### Files Changed
`lib/templates/*`, `lib/profile/*`, `lib/email/content.ts`, `components/templates/*`,
`components/email/*`, `app/(app)/templates`, `app/(app)/settings`, `app/(app)/applications/[id]/compose`.

### Database Changes
`EmailTemplate`, `Profile`.

### Testing
Unit (rendering, text⇄HTML); integration (CRUD, unique names); E2E (composer).

### Documentation Updated
`docs/features/email-templates.md`, `docs/features/email-sending.md`.

---

## 2026-10-01 — Phase 3: Documents

### Feature
CV / cover letter / other document library with upload, rename, delete, default per type,
selection on applications and attachment to emails.

### Problem
Several CVs must be reusable across applications without re-uploading.

### Implementation
Magic-byte validation (PDF/DOCX/DOC, 5 MB), local storage with random keys outside `public/`,
authenticated download route, library + `ApplicationDocument` link table, attachment snapshots.

### Files Changed
`lib/documents/*`, `lib/storage/local.ts`, `app/actions/documents.ts`,
`app/api/documents/[id]/download/route.ts`, `components/documents/*`, `next.config.ts` (6 MB body limit).

### Database Changes
`Document`, `ApplicationDocument`, `EmailAttachment`.

### Testing
Unit (validation, filenames); integration (defaults, deletion, disguised files); E2E (upload).

### Documentation Updated
`docs/features/documents.md`, ADR-005, ADR-007.

---

## 2026-10-01 — Phase 2: Application management

### Feature
Application CRUD, dashboard table with search/filter/sort/pagination, details page, status
management with lifecycle, status history and timeline.

### Problem
Core tracking of applications and their progress.

### Implementation
Service layer with transactions and timeline events, `APP-0001` IDs from a counter, status
configuration with transition rules, URL-driven query parsing, server-rendered table with client
toolbar/row actions, React Hook Form + Zod forms.

### Files Changed
`lib/applications/*`, `app/actions/applications.ts`, `components/applications/*`,
`app/(app)/applications/**`, `app/(app)/page.tsx`.

### Database Changes
`Application`, `ApplicationTechnology`, `StatusHistory`, `ApplicationEvent`, `Counter`.

### Testing
Unit (status, IDs, validation, query); integration (CRUD, transitions, cascades, filtering).

### Documentation Updated
`docs/features/applications.md`, `docs/features/status-tracking.md`, `docs/architecture/data-flow.md`.

---

## 2026-10-01 — Phase 1: Foundation

### Feature
Project foundation: Next.js 16, TypeScript, Tailwind 4, shadcn/ui, MySQL + Prisma 7, auth,
app shell, environment configuration, documentation structure.

### Problem
Need a clean, scalable base that can grow into a SaaS.

### Implementation
App Router with `(app)` route group and sidebar shell (dark/light, toasts, loading/error/404
states); single-user password auth (HMAC session cookie, `proxy.ts`, `requireAuth` in actions);
Zod-validated env (`lib/env.ts`); Prisma 7 with the MariaDB driver adapter; Docker Compose MySQL
with a test database; JSON logger with redaction; seed script.

### Files Changed
`app/layout.tsx`, `app/(app)/layout.tsx`, `app/login`, `proxy.ts`, `lib/auth/*`, `lib/env.ts`,
`lib/db.ts`, `lib/prisma-client.ts`, `lib/logger.ts`, `lib/errors.ts`, `prisma/*`,
`prisma.config.ts`, `docker-compose.yml`, `components/layout/*`, `.env.example`.

### Database Changes
Initial migration `20261001151350_init`.

### Testing
Typecheck, lint, local smoke test (login, health endpoint).

### Documentation Updated
`README.md`, `docs/README.md`, `docs/architecture/*`, `docs/setup/*`, `docs/database/*`,
ADR-001, ADR-002, ADR-006.
