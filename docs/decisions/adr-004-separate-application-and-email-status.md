# Decision

ADR-004: Keep application status and email delivery status as separate concepts.

Status: Accepted · Date: 2026-10-01

## Context

An application moves through a hiring pipeline (Draft → Applied → … → Offer / Rejected). Each
email sent for it has its own technical lifecycle (Sending → Sent → Delivered / Bounced /
Complaint, or Failed).

## Problem

Should email events drive the application status (e.g. "Delivered" ⇒ "Acknowledged"), or be
tracked independently?

## Options Considered

1. **Separate fields and lifecycles**: `Application.status` (`ApplicationStatus`) and
   `Email.emailStatus` (`EmailStatus`), with one exception: a successful send moves `Draft → Applied`.
2. A single combined status.
3. Automatically map delivery events onto application statuses.

## Decision

Option 1.

```text
Application: Applied        ← what the hiring process says (set by you)
Email:       Delivered      ← what the mail system says (set by SES events)
```

The only automatic application transition is **Draft → Applied after SES accepts the email**,
because sending the application *is* applying. Delivery, bounce and complaint events update only
the email and add timeline entries.

## Reasons

- "Delivered" means the recipient's mail server accepted the message. It does **not** mean a
  person read it or that the employer reviewed the application; mapping it to "Acknowledged"
  would be false.
- One application can have several emails (follow-ups, re-sends), each with its own delivery state.
- Applications submitted through job portals have no email at all, but still have a status.
- Clean separation keeps both lifecycles simple and testable (`lib/applications/status.ts`,
  `lib/email/delivery-status.ts`).

## Consequences

- The UI shows both badges (table: status + latest email badge; details: "Delivery status").
- A bounce does not change the application; you decide what to do (fix the address, re-send,
  mark Withdrawn).
- Analytics count application statuses; email delivery is summarised separately.

## Future Considerations

Inbox integration could suggest status changes from real replies (e.g. "Thanks, we received your
application" → Acknowledged) — as suggestions requiring confirmation, still not from delivery events.
