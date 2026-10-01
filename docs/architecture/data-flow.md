# Data Flow

## Reading data (Server Components)

```text
GET /applications?q=react&status=APPLIED&page=2
  → proxy.ts            verify session cookie (redirect to /login if missing)
  → (app)/layout.tsx    requirePageAuth() (defence in depth)
  → applications/page   parseApplicationQuery(searchParams)        lib/applications/query.ts (pure)
                        listApplications(query)                    lib/applications/service.ts
                          → buildApplicationWhere / buildApplicationOrderBy
                          → db.$transaction([count, findMany])     Prisma → MySQL
  ← HTML streamed to the browser (loading.tsx skeleton shown meanwhile)
```

URL query parameters are the single source of truth for list state (search, filters, sort,
page, page size). Client components (`ApplicationsToolbar`, sort headers, pagination) only
change the URL; the server re-renders with the new query. Views are therefore bookmarkable
and the back button works.

## Mutations (Server Actions)

```text
<ApplicationForm> (client)
  → zodResolver(applicationFormSchema)        client-side validation (instant feedback)
  → createApplicationAction(values)           app/actions/applications.ts  ("use server")
      runAction:
        requireAuth()                         lib/auth/session.ts
        applicationFormSchema.safeParse()     server-side validation (authoritative)
        toApplicationInput()                  normalise (tech stack, emails, dates)
        createApplication(input)              lib/applications/service.ts
          db.$transaction:
            counter UPDATE (+1)  → APP-000N
            INSERT Application + technologies + document links + StatusHistory
            INSERT ApplicationEvent(APPLICATION_CREATED)
        revalidatePath("/", "/applications", "/analytics")
      ← { ok: true, data: { id, applicationId }, message }
  → toast + router.push(`/applications/${id}`)
```

Failures return `{ ok: false, error, code, fieldErrors }` and are shown inline + as a toast.

## Timeline / event system

Every important change writes an `ApplicationEvent` **in the same transaction** as the change:

| Event type | Written by |
| --- | --- |
| `APPLICATION_CREATED` | `createApplication` |
| `APPLICATION_UPDATED` (metadata: changed fields) | `updateApplication` |
| `DOCUMENTS_UPDATED` | `updateApplication` when document links change |
| `STATUS_CHANGED` (metadata: from/to) | `changeApplicationStatus`, `updateApplication`, email send |
| `EMAIL_SENT` (metadata: emailId, sesMessageId, attachments) | `sendEmailForApplication` |
| `EMAIL_FAILED` | `sendEmailForApplication` |
| `EMAIL_DELIVERED` / `EMAIL_BOUNCED` / `EMAIL_COMPLAINT` | `applySesEvent` (webhook) |
| `NOTE` | `addApplicationNote` (free text, e.g. "Technical interview scheduled") |

The details page renders events newest first (`components/applications/timeline.tsx`).
`StatusHistory` is a separate, structured record of status changes (from → to + note).

## File download

```text
GET /api/documents/:id/download[?inline=1]
  → proxy.ts (401 JSON for unauthenticated API calls)
  → route handler: isAuthenticated() → getDocumentWithContent(id) → stream bytes
     headers: Content-Disposition (attachment | inline for PDFs), nosniff, no-store
```

## Email delivery events

See [email-flow.md](email-flow.md).
