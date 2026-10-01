# Application Architecture

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│ Presentation                                                  │
│  app/(app)/**/page.tsx   Server Components (data loading)     │
│  components/**           Client Components (interaction)      │
├──────────────────────────────────────────────────────────────┤
│ Transport                                                     │
│  app/actions/*.ts        Server Actions (mutations)           │
│  app/api/**/route.ts     Route Handlers (HTTP endpoints)      │
│  proxy.ts                Request gate (auth)                  │
├──────────────────────────────────────────────────────────────┤
│ Domain / business logic (lib/)                                │
│  services   applications · documents · templates · email ·    │
│             analytics · profile                               │
│  rules      status lifecycle · delivery precedence · IDs ·    │
│             validation schemas · template rendering           │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure                                                │
│  lib/db.ts + lib/prisma-client.ts  (Prisma → MySQL)           │
│  lib/email/ses.ts                  (AWS SES)                  │
│  lib/storage/local.ts              (filesystem)               │
│  lib/env.ts · lib/logger.ts                                   │
└──────────────────────────────────────────────────────────────┘
```

Rules (enforced by review and the `server-only` guard):

1. Components contain **no business logic** and never import Prisma or AWS.
2. Server Actions are thin: `runAction(name, () => { validate; call service; revalidatePath })`.
3. Services own transactions, invariants and timeline events.
4. Pure modules (status, schemas, render, query, content, payload) have no I/O and are unit-tested.

## Directory reference

| Path | Responsibility |
| --- | --- |
| `app/layout.tsx` | Root HTML, fonts, `Providers` (theme, tooltips, toasts) |
| `app/(app)/layout.tsx` | Authenticated shell (sidebar + mobile header); `requirePageAuth()` |
| `app/(app)/page.tsx` | Dashboard: stats, status chart, 6-month trend, recently updated |
| `app/(app)/applications/**` | List, new, details, edit, compose |
| `app/(app)/templates`, `documents`, `analytics`, `settings` | Feature pages |
| `app/(app)/loading.tsx`, `error.tsx`, `not-found.tsx` | Skeleton, error and 404 states |
| `app/login/page.tsx` | Sign-in |
| `app/actions/*.ts` | Server Actions per feature |
| `app/api/documents/[id]/download` | Authenticated file download |
| `app/api/webhooks/ses` | SNS → SES delivery events (public, signature-verified) |
| `app/api/health` | Liveness/readiness probe |
| `components/ui/` | shadcn/ui primitives (generated; do not put logic here) |
| `components/<feature>/` | Feature components |
| `lib/applications/` | `status.ts`, `source.ts`, `application-id.ts`, `schemas.ts`, `query.ts`, `events.ts`, `service.ts` |
| `lib/email/` | `ses.ts`, `service.ts`, `payload.ts`, `content.ts`, `sanitize.ts`, `schemas.ts`, `delivery-status.ts`, `sns.ts`, `delivery-events.ts` |
| `lib/documents/` | `validation.ts` (pure), `service.ts` |
| `lib/storage/local.ts` | Filesystem storage backend |
| `lib/templates/` | `render.ts` (pure), `schemas.ts`, `service.ts` |
| `lib/analytics/` | `aggregate.ts` (pure), `service.ts` |
| `lib/auth/` | `token.ts` (Web Crypto, pure), `session.ts` (cookies) |
| `lib/actions/run-action.ts` | Auth + error mapping wrapper for actions |
| `lib/errors.ts` | `AppError` codes and `ActionResult` type |
| `lib/env.ts` | Zod-validated server configuration |
| `lib/logger.ts` | JSON logger with secret redaction |
| `lib/generated/prisma/` | Generated Prisma client (gitignored; `npm install` regenerates) |
| `prisma/` | Schema, migrations, seed |
| `tests/` | `unit/`, `integration/`, `e2e/`, `support/` |

## Error model

- Services throw `AppError(code, message, fieldErrors?)` for expected failures
  (`NOT_FOUND`, `VALIDATION`, `CONFLICT`, `INVALID_TRANSITION`, `RATE_LIMITED`,
  `DUPLICATE_SEND`, `EMAIL_SEND_FAILED`, `CONFIGURATION`, `UNAUTHORIZED`).
- `runAction` converts them to `{ ok: false, error, code, fieldErrors }`; forms map
  `fieldErrors` onto inputs and show a toast.
- Unexpected errors are logged (`lib/logger.ts`) and returned as a generic message.
- Rendering errors are caught by `app/(app)/error.tsx`.

## Rendering model

All authenticated pages are dynamic (rendered per request) because the shell reads the
session cookie. Pages fetch in parallel with `Promise.all`. After a mutation, actions call
`revalidatePath(...)` and client components call `router.refresh()` so the server-rendered
data is fresh.

## Next.js 16 specifics used

- `proxy.ts` instead of `middleware.ts` (renamed in v16; Node.js runtime).
- Async `params` / `searchParams` and the generated `PageProps<'/route'>`, `LayoutProps`,
  `RouteContext` helpers (`npx next typegen`).
- `experimental.serverActions.bodySizeLimit = "6mb"` for 5 MB uploads.
- Turbopack for dev and build.
