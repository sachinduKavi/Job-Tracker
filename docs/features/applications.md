# Applications & Dashboard

## Purpose

Record every job application (company, role, tech stack, location, source, job URL, notes,
draft email, documents), find it again quickly, and see everything that happened to it.

## User Flow

1. **Dashboard (`/`)** — headline stats, status chart, 6-month trend and the 8 most recently
   updated applications.
2. **Applications (`/applications`)** — the primary table:

   | Application ID | Date Applied | Company | Position | Tech Stack | Location | Status | Source |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | APP-0001 | Oct 1, 2026 | Veyrion | Associate Software Engineer | C#, .NET, React | Colombo | Applied | LinkedIn |

   The status cell also shows the latest email's delivery badge. Each row's ⋯ menu offers
   **View, Edit, Send email, Change status, Delete**.
3. **New (`/applications/new`)** — form in three cards: Basic information, Email (draft, can be
   filled from a template), Documents (CV, cover letter, additional). The default CV is preselected.
4. **Details (`/applications/[id]`)** — application information, latest email (recipient, CC, BCC,
   subject, body preview, sent date, SES Message ID, delivery status, attachments), earlier
   emails, documents, timeline with "Add note", and status history.
5. **Edit (`/applications/[id]/edit`)** — same form; the status list offers only the current
   status and its allowed transitions.

## Architecture

```text
page.tsx (Server Component) ── parseApplicationQuery(searchParams) ── listApplications()
  ├── ApplicationsToolbar (client) — writes search/filters to the URL
  ├── ApplicationsTable (server)   — sort headers are links (?sort=&order=)
  │     └── RowActions (client)    — dropdown, ChangeStatusDialog, DeleteApplicationDialog
  └── ApplicationsPagination (server) — page links + page size
ApplicationForm (client, RHF + Zod) ── createApplicationAction / updateApplicationAction
```

## Implementation

| Concern | File |
| --- | --- |
| Service (CRUD, list, filter options) | `lib/applications/service.ts` |
| Form schema + normalisation | `lib/applications/schemas.ts` |
| URL query ⇄ Prisma filter | `lib/applications/query.ts` |
| Timeline writes | `lib/applications/events.ts` |
| Status rules | `lib/applications/status.ts` ([status-tracking.md](status-tracking.md)) |
| Sources | `lib/applications/source.ts` |
| Server Actions | `app/actions/applications.ts` |
| UI | `components/applications/*`, `app/(app)/applications/**` |

### Search, filtering and sorting

All list state lives in URL query parameters, parsed and whitelisted on the server:

| Param | Meaning | Example |
| --- | --- | --- |
| `q` | Free text across application ID, company, position, location and tech stack | `q=react` |
| `status` | Comma-separated statuses | `status=APPLIED,HR_SCREENING` |
| `source` | Comma-separated sources | `source=LINKEDIN` |
| `company`, `position`, `location` | Contains-filters | `location=remote` |
| `from`, `to` | `dateApplied` range (YYYY-MM-DD, inclusive) | `from=2026-09-01&to=2026-09-30` |
| `sort` | `dateApplied` (default), `company`, `position`, `status`, `applicationId`, `updatedAt` | `sort=company` |
| `order` | `asc` / `desc` (default `desc`) | `order=asc` |
| `page`, `pageSize` | Pagination; page size 10/20/50/100 (default 20) | `page=2&pageSize=50` |

- Matching is case-insensitive because the columns use a `_ci` collation (Prisma's
  `mode: "insensitive"` is not available on MySQL).
- Sorting by status uses lifecycle order (MySQL sorts `ENUM` by declaration order).
- Sorting by date puts applications without a date last (descending) / first (ascending);
  a secondary order (`createdAt desc, id`) keeps pages stable.
- Search input is debounced (300 ms); changing any filter resets to page 1; "Clear" removes all.
- Indexed columns: status, source, dateApplied, company, position, location, createdAt,
  technology name.

### Application ID strategy

- Internal primary key: CUID (`id`), used in URLs and foreign keys — not guessable, no
  information leakage, safe to generate anywhere.
- Display ID: `applicationId` = `APP-` + 4-digit zero-padded sequence (`APP-0001`, …,
  `APP-9999`, then `APP-10000`) — `lib/applications/application-id.ts`.
- Sequence: a `Counter` row (`name = "application"`). `createApplication` ensures the row
  exists (`INSERT IGNORE`, outside the transaction to avoid InnoDB deadlocks), then inside the
  creating transaction runs `UPDATE Counter SET value = value + 1`, which row-locks the counter
  so concurrent creations are serialised. If the transaction rolls back the number is released.
- IDs are never reused after a delete (the counter only increases).
- The `applicationId` column has a unique index as a final guard.

### Timeline

Every create/update/status change/email/delivery event/note writes an `ApplicationEvent` in
the same transaction as the change. See [data-flow.md](../architecture/data-flow.md#timeline--event-system).

## Database Changes

Tables `Application`, `ApplicationTechnology`, `ApplicationDocument`, `StatusHistory`,
`ApplicationEvent`, `Counter` (migration `init`). See [schema.md](../database/schema.md).

## Server Actions / API

| Action | Input | Result |
| --- | --- | --- |
| `createApplicationAction(values)` | `ApplicationFormValues` | `{ id, applicationId }` |
| `updateApplicationAction(id, values)` | id + `ApplicationFormValues` | `{ id }` |
| `changeStatusAction({ applicationId, toStatus, note })` | | `{ changed }` |
| `addNoteAction({ applicationId, note })` | | — |
| `deleteApplicationAction(id)` | | — |

All return `ActionResult` (`{ ok: true, data, message }` or `{ ok: false, error, code, fieldErrors }`).

## Validation

`applicationFormSchema` (client via `zodResolver`, server in every action): company and
position required (≤ 200), valid date, http(s) job URL, valid recipient email, CC/BCC lists of
valid emails (≤ 20), enum status/source, length limits matching columns. Tech stack is split on
commas, trimmed and de-duplicated case-insensitively (≤ 30 items). Linked document IDs must
exist (checked in the service).

## Security

Authenticated actions only; server-side validation; Prisma parameterised queries; whitelisted
sort fields. See [security.md](../architecture/security.md).

## Testing

- Unit: `tests/unit/validation.test.ts`, `application-id.test.ts`, `query-and-analytics.test.ts`.
- Integration: `tests/integration/applications.test.ts` — sequential & concurrent IDs, history,
  events, transitions, cascades, search/filter/sort/pagination against MySQL.
- E2E: `tests/e2e/send-application.spec.ts` — creation, validation messages, search/filter URL.

## Error Handling

Field errors appear under inputs; other errors as toasts. Unknown IDs render the 404 state;
rendering failures show `error.tsx` with a retry button.

## Known Limitations

- No bulk actions or CSV import/export.
- The location filter is a contains-match with suggestions, not a fixed list.
- Tech stack search uses `contains` (e.g. "Java" also matches "JavaScript").

## Future Improvements

CSV export, saved views, bulk status changes, follow-up reminders, kanban board by status.
