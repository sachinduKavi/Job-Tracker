# Status Tracking

## Purpose

Know where every application stands, how it got there, and keep transitions sensible.

## User Flow

- Set the initial status when creating an application (usually **Draft**).
- Change status from the row menu or the details page (**Change status** dialog: allowed
  targets only + optional note), or in the edit form.
- Sending the application email moves **Draft → Applied** automatically.
- The details page shows the **Status history** (from → to, time, note) and the timeline.

## Statuses

Defined once in `lib/applications/status.ts` (`STATUS_CONFIG`: label, description, category,
badge colours, chart colour). The database stores the enum value; UI code must never
hard-code labels.

| Value | Label | Category |
| --- | --- | --- |
| `DRAFT` | Draft | draft |
| `APPLIED` | Applied | active |
| `ACKNOWLEDGED` | Acknowledged | active |
| `HR_SCREENING` | HR Screening | interview |
| `TECHNICAL_INTERVIEW` | Technical Interview | interview |
| `FINAL_INTERVIEW` | Final Interview | interview |
| `OFFER` | Offer | offer |
| `REJECTED` | Rejected | closed |
| `WITHDRAWN` | Withdrawn | closed |
| `NO_RESPONSE` | No Response | closed |

## Lifecycle

```text
Draft
  ↓
Applied
  ↓
Acknowledged
  ↓
HR Screening
  ↓
Technical Interview
  ↓
Final Interview
  ↓
Offer
```

Rules (`STATUS_TRANSITIONS`):

- Forward along the pipeline; **stages may be skipped** (Applied → Technical Interview).
- **No backwards moves** (Final Interview → HR Screening is rejected).
- **Draft** → Applied (sent) or Withdrawn (abandoned) only.
- **Rejected / Withdrawn** reachable from every submitted stage (Applied … Offer).
- **No Response** reachable from Applied … Final Interview (not after an offer).
- **Rejected** and **Withdrawn** are terminal.
- **No Response** can be re-opened (→ Acknowledged, HR Screening, Technical Interview, Rejected,
  Withdrawn) when the employer replies late.

| From | Allowed targets |
| --- | --- |
| Draft | Applied, Withdrawn |
| Applied | Acknowledged, HR Screening, Technical Interview, Final Interview, Offer, Rejected, Withdrawn, No Response |
| Acknowledged | HR Screening, Technical Interview, Final Interview, Offer, Rejected, Withdrawn, No Response |
| HR Screening | Technical Interview, Final Interview, Offer, Rejected, Withdrawn, No Response |
| Technical Interview | Final Interview, Offer, Rejected, Withdrawn, No Response |
| Final Interview | Offer, Rejected, Withdrawn, No Response |
| Offer | Rejected, Withdrawn |
| Rejected / Withdrawn | — (terminal) |
| No Response | Acknowledged, HR Screening, Technical Interview, Rejected, Withdrawn |

## Architecture & Implementation

- `canTransition(from, to)` is used by the Change Status dialog (to list options) and by
  `changeApplicationStatus` / `updateApplication` on the server (authoritative).
- Every change writes, in one transaction: the new status, a `StatusHistory` row and a
  `STATUS_CHANGED` timeline event (metadata `{ from, to }`).
- Setting the same status again is a no-op.

## Database Changes

`Application.status` (ENUM, indexed), `StatusHistory` table.

## Server Actions / API

`changeStatusAction({ applicationId, toStatus, note })`; status is also part of
`updateApplicationAction`.

## Validation

Zod enum on input; lifecycle check in the service → `AppError("INVALID_TRANSITION")`.

## Security

Authenticated actions; server-side lifecycle enforcement (the dialog's filtering is only UX).

## Testing

`tests/unit/status.test.ts` (rules), `tests/integration/applications.test.ts` (history,
events, invalid transitions, edit-form path), E2E checks Draft → Applied after sending.

## Error Handling

Invalid transitions return "Cannot change status from X to Y" as a toast/field error.

## Known Limitations

- Terminal statuses cannot be undone through the UI (by design; correct via the database if
  you mis-click — see troubleshooting).
- Status is not changed automatically by employer replies (no mailbox integration).

## Future Improvements

Configurable pipelines, interview scheduling events, automatic **No Response** after N days.

See also: [ADR-004](../decisions/adr-004-separate-application-and-email-status.md) — why email
delivery status is separate.
