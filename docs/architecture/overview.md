# Architecture Overview

## System diagram

```text
User (browser)
 │  HTTPS
 ▼
Next.js Application (single Node.js process)
 │
 ├── proxy.ts ─────────────── authentication gate for every request
 │
 ├── UI
 │   ├── Server Components (app/(app)/**/page.tsx) — read data, render HTML
 │   └── Client Components (components/**) — forms, dialogs, charts, toasts
 │
 ├── Server Actions (app/actions/*.ts) — mutations: auth → Zod → service → revalidate
 │
 ├── Route Handlers (app/api/**) — document download, SES webhook, health check
 │
 ├── Business Logic (lib/**) — services, validation, status rules, email flow
 │
 ├── Prisma 7 (+ @prisma/adapter-mariadb)
 │      ▼
 │   MySQL 8 ── application data (applications, emails, documents, events, …)
 │
 ├── Local file storage (STORAGE_DIR) ── uploaded CVs / cover letters
 │
 └── AWS SDK v3 (lib/email/ses.ts)
        ▼
     Amazon SES ──► Employer's mail server
        │
        └─► (configuration set) ─► Amazon SNS ─► POST /api/webhooks/ses ─► delivery status
```

## Why Next.js full-stack

JobTrack is a personal tool that should be able to grow into a SaaS. One Next.js app gives:

- **One deployable, one language, one type system.** UI and server code share Zod schemas,
  status configuration and types; there is no API contract to keep in sync.
- **Server Components** read from the database directly on the server, so pages ship HTML
  rather than loading spinners and JSON round trips.
- **Server Actions** give typed RPC for mutations with built-in CSRF protection
  (same-origin check) and progressive enhancement.
- **Route Handlers** cover the few HTTP endpoints that must exist (SES webhook, file download, health).

See [ADR-001](../decisions/adr-001-nextjs-fullstack.md).

## Why not a separate NestJS backend (yet)

A separate backend adds a second deployable, an HTTP API to design/version/secure, CORS,
service-to-service auth and duplicated types — with no benefit for a single user and a single
client. The trigger for splitting is documented in [future-architecture.md](future-architecture.md)
(e.g. a mobile app or public API needs the same business logic).

## How server and client code are separated

| Layer | Location | Runs on | May import |
| --- | --- | --- | --- |
| Pure shared modules | `lib/**/status.ts`, `schemas.ts`, `render.ts`, `query.ts`, `content.ts`, `validation/` | server + browser | other pure modules, generated **enums** only |
| Server-only services | `lib/**/service.ts`, `lib/db.ts`, `lib/email/ses.ts`, `lib/env.ts`, `lib/storage/` | server only | anything |
| Server Actions | `app/actions/*.ts` (`"use server"`) | server | services |
| Client Components | `components/**` (`"use client"`) | browser (+SSR) | pure modules, Server Actions |

Every server-only module starts with `import "server-only"`; importing one from a Client
Component **fails the build**. This is what guarantees AWS credentials, the database client
and secrets never reach the browser bundle.

## How database access works

- `lib/db.ts` exports a lazily-created Prisma client singleton (cached on `globalThis` in dev
  to survive hot reload). Prisma 7 uses the `@prisma/adapter-mariadb` driver adapter, which
  speaks the MySQL protocol.
- Only `lib/**/service.ts` files (and `lib/email/delivery-events.ts`) query the database.
  Pages call service functions; Server Actions call service functions; components never do.
- Multi-step changes run in `db.$transaction` so that, for example, a status change, its
  `StatusHistory` row and its timeline event are written together or not at all.

## How AWS SES integration works

`lib/email/ses.ts` is the only file importing the AWS SDK. It builds an SES v2 `SendEmail`
request (via the pure `lib/email/payload.ts`) and sends it. `lib/email/service.ts`
orchestrates the full flow (rate limit → duplicate check → reserve row → send → record →
status change). Credentials come from the AWS SDK default provider chain. Delivery events
come back through SNS to `/api/webhooks/ses`. Details: [email-flow.md](email-flow.md).

## How authentication & security are handled

Single-user password login (`APP_PASSWORD`) creates an HMAC-signed, HttpOnly session cookie.
`proxy.ts` blocks unauthenticated requests; every Server Action and protected Route Handler
re-checks the session. All input is validated with Zod on the server. See
[security.md](security.md) and [ADR-006](../decisions/adr-006-single-user-authentication.md).

## How the system can evolve

Because the business logic already lives in framework-agnostic service modules with typed
inputs, a dedicated API (Next.js Route Handlers or NestJS) can wrap `lib/**/service.ts`
without rewriting it. See [future-architecture.md](future-architecture.md).

## Related

- [application-architecture.md](application-architecture.md) — folder-level detail
- [data-flow.md](data-flow.md) — request lifecycles
- [email-flow.md](email-flow.md)
- [security.md](security.md)
