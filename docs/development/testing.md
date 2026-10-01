# Testing

| Level | Tool | Location | Needs | Command |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `tests/unit/` | nothing | `npm run test:unit` |
| Integration | Vitest | `tests/integration/` | MySQL test DB | `npm run test:integration` |
| End-to-end | Playwright (Chromium) | `tests/e2e/` | MySQL test DB, browser | `npm run test:e2e` |

`npm test` runs unit + integration; `npm run test:all` adds E2E.

## Test environment

- `.env.test` (committed, local values only): `DATABASE_URL=…/jobtrack_test` on the Docker
  MySQL (`docker compose up -d`), `EMAIL_TRANSPORT=mock`, fixed `APP_PASSWORD=test-password-123`,
  `STORAGE_DIR=./storage/test-uploads`.
- **Safety guard:** `tests/support/load-test-env.ts` refuses to run unless the database name ends
  in `_test`. Integration and E2E setup **delete all rows** in that database.
- `vitest.config.ts` aliases `server-only` to an empty module (it only works inside Next.js) and `@/`.
- Integration tests run serially (`fileParallelism: false`); each test starts from an empty
  database (`tests/support/integration-setup.ts` → `resetDatabase()`); migrations are applied
  once per run (`integration-global-setup.ts` → `prisma migrate deploy`).
- Amazon SES is never called by tests: the `mock` transport records messages in memory, and the
  SES path is tested with an injected fake client (`setSesClientForTesting`).

## What is covered

### Unit (pure logic)

| File | Covers |
| --- | --- |
| `template-render.test.ts` | variable replacement, whitespace, missing/unknown variables, no double substitution |
| `status.test.ts` | lifecycle transitions, terminal states, re-opening, delivery-status precedence |
| `validation.test.ts` | application/compose schemas, normalisation, tech stack & email lists, file magic-byte validation, filename sanitising |
| `application-id.test.ts` | `APP-0001` formatting, > 9999, parsing, invalid input |
| `email-payload.test.ts` | SES v2 request (recipients, bodies, attachments, tags), text⇄HTML, HTML sanitisation, SES error mapping |
| `query-and-analytics.test.ts` | URL query parsing/serialising/where-clause, monthly series & top-N, session tokens, SNS URL trust, string-to-sign, SES notification parsing |

### Integration (real MySQL)

| File | Covers |
| --- | --- |
| `applications.test.ts` | creating applications (sequential + concurrent IDs, history, events), status updates (valid/invalid, edit form), notes, cascading deletes, search/filter/sort/pagination |
| `email-service.test.ts` | send flow with mock transport (message ID, Sent, Draft → Applied, sanitised body, attachments), idempotency, re-send confirmation, rate limit, unknown application; SES transport with a fake client (request shape, MessageId stored), SES failure path, missing sender; delivery events (precedence, unknown IDs, application status untouched) |
| `documents-templates-analytics.test.ts` | upload/defaults/rename/read/delete + file cleanup, disguised file rejection, template CRUD + unique names, analytics metrics and breakdowns |

### End-to-end (`tests/e2e/send-application.spec.ts`)

1. Auth: redirect to login, wrong password rejected.
2. **Critical workflow:** upload CV → create application (validation messages first) → default
   CV preselected → compose (prefilled) → preview (HTML iframe + plain text) → confirmation dialog
   (company, position, recipient, attachment) → send (mock SES) → details page shows **Applied**,
   **Sent**, an SES Message ID and timeline entries.
3. Duplicate protection: a second send to the same recipient shows the re-send warning.
4. Search and status filter update the URL and the table.

Playwright starts `next dev` on port 3200 with `.env.test` (`playwright.config.ts`), applies
migrations and resets the test DB in `tests/e2e/global-setup.ts`. Traces and screenshots are kept
on failure (`test-results/`).

## Running

```bash
docker compose up -d                 # once
npx playwright install chromium      # once
npm run test:unit
npm run test:integration
npm run test:e2e
npx vitest --project unit            # watch mode
npx playwright test --ui             # interactive E2E
```

## Manual test with real SES

Automated tests never send real email. Before a release, send one email from a staging
environment to an address you control (or `success@simulator.amazonses.com`) and confirm the
Message ID appears and, with tracking enabled, the status becomes **Delivered**
([aws/ses.md](../aws/ses.md#sending-a-test-email)).

## Writing new tests

- Pure function → unit test next to similar ones.
- Service behaviour/queries → integration test; create data through services, not raw SQL.
- User-visible flow → E2E; prefer roles/labels, use `data-testid` only for values without a
  good accessible name.
- Never point tests at a real database or real SES.
