# Future Architecture

Nothing on this page is implemented. It records how the current design is meant to evolve.

## Target shape

```text
                    ┌──────────────┐
                    │   Next.js    │   web UI (and BFF)
                    │   Frontend   │
                    └──────┬───────┘
                           │ HTTPS (JSON)
                           ▼
                    ┌──────────────┐
                    │    API       │   Next.js Route Handlers or NestJS
                    │  Next/Nest   │   (auth, multi-tenant, rate limits)
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
           MySQL          SES          Redis
                                (sessions, rate limits, queues)
```

## Why the current code is ready for it

- **Services are framework-agnostic.** `lib/**/service.ts` take plain typed input
  (`ApplicationInput`, `ComposeEmailValues`, …) and throw `AppError`; they don't depend on
  React or Server Action specifics. An API controller can call them unchanged.
- **Validation is reusable.** The same Zod schemas would validate API request bodies.
- **Infrastructure is isolated.** SES (`lib/email/ses.ts`), storage (`lib/storage/local.ts`)
  and the DB client (`lib/db.ts`) each sit behind a small interface.
- **Status rules are data** (`lib/applications/status.ts`), easy to share with other clients.

## Migration steps (when needed)

1. Add `/api/v1/*` Route Handlers that call existing services (no logic in handlers).
2. Introduce token auth (e.g. OAuth / JWT) next to the cookie session.
3. Add `userId` to every table (multi-tenancy), scope all service queries by user, and a
   `User` model; update unique constraints (e.g. template name per user).
4. Move rate limiting / login throttling / idempotency to Redis.
5. Replace local storage with S3 (pre-signed URLs) — same `putObject/getObject/removeObject` contract.
6. Move email sending to a queue worker (SQS or BullMQ) for retries and scheduled follow-ups.
7. Only then, if the API team/scale needs it, lift the services into a NestJS app; the
   Next.js app becomes a pure frontend calling the API.

## Triggers for splitting out a backend

- A second client (mobile app, browser extension, public API) needs the same logic.
- Background jobs (follow-up reminders, mailbox sync) outgrow request/response.
- Independent scaling or team ownership of the API.

## Candidate features (backlog)

Mobile application · browser extension (save jobs from LinkedIn) · Gmail / Outlook
integration (detect replies → auto status) · AI-generated emails and cover letters · job
description parsing · CV matching · interview management · follow-up reminders · recruiter
management · automated notifications · public API.
