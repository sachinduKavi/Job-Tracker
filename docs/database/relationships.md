# Relationships

```text
                      ┌────────────────────┐
                      │    Application     │
                      └─────────┬──────────┘
        ┌──────────────┬────────┼───────────┬─────────────────┐
        │1:N cascade   │1:N     │1:N        │1:N cascade      │1:N cascade
        ▼              ▼        ▼           ▼                 ▼
 ApplicationTechnology Email  StatusHistory ApplicationEvent  ApplicationDocument
                        │ 1:N cascade                          │ N:1 cascade
                        ▼                                      ▼
                  EmailAttachment ──── N:1 (SET NULL) ───► Document

 EmailTemplate, Profile, Counter — standalone
```

## Foreign keys

| Child → Parent | On delete | On update | Why |
| --- | --- | --- | --- |
| `ApplicationTechnology.applicationId → Application.id` | CASCADE | CASCADE | technologies have no meaning without the application |
| `Email.applicationId → Application.id` | CASCADE | CASCADE | deleting an application deletes its email history |
| `EmailAttachment.emailId → Email.id` | CASCADE | CASCADE | attachment snapshot belongs to the email |
| `EmailAttachment.documentId → Document.id` | **SET NULL** | CASCADE | deleting a library file must not erase what was sent; filename/size stay on the snapshot |
| `ApplicationDocument.applicationId → Application.id` | CASCADE | CASCADE | link row only |
| `ApplicationDocument.documentId → Document.id` | CASCADE | CASCADE | deleting a document unlinks it from applications |
| `StatusHistory.applicationId → Application.id` | CASCADE | CASCADE | history belongs to the application |
| `ApplicationEvent.applicationId → Application.id` | CASCADE | CASCADE | timeline belongs to the application |

Deleting an **application** removes its technologies, emails (+ attachment snapshots), document
links, status history and events — but never the documents in the library.

Deleting a **document** removes its file from storage, its application links, and nulls the
`documentId` of email attachment snapshots. If it was the default for its type, the newest
remaining document of that type becomes the default (service logic).

## Invariants enforced in code (not by the database)

| Invariant | Where |
| --- | --- |
| At most one default document per type | `lib/documents/service.ts` (transaction) |
| Status changes follow the lifecycle | `lib/applications/status.ts` + `service.ts` |
| Each status change has a StatusHistory row and a STATUS_CHANGED event | `changeApplicationStatus`, `updateApplication` |
| Email delivery status only moves forward | `nextDeliveryStatus` in `lib/email/delivery-status.ts` |
| `applicationId` numbers are sequential and unique | `Counter` row + unique index |
