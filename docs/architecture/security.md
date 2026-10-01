# Security

This page lists every security control in JobTrack, where it is implemented and why.

## Threat model (summary)

JobTrack is a single-user application holding personal data (CVs, contact details,
employer correspondence) and AWS credentials that can send email in your name. The main
risks are: account takeover, credential leakage, abuse of the email sender (spam, reputation
damage), malicious file uploads, script injection through email HTML, and forged webhook calls.

## Authentication

- **Mechanism:** single password (`APP_PASSWORD`) → stateless session token
  `v1.<expiry>.<HMAC-SHA256>` signed with `SESSION_SECRET` (`lib/auth/token.ts`).
- **Cookie:** `jobtrack_session`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry.
- **Password comparison** is constant time (SHA-256 digests + XOR compare).
- **Brute force:** 5 failed attempts per IP per 15 minutes (in-memory, `app/actions/auth.ts`).
- **Open redirect protection:** the `next` parameter must be a same-site relative path.
- **Gates:** `proxy.ts` redirects pages / returns 401 for APIs; `(app)/layout.tsx` calls
  `requirePageAuth()`; **every Server Action** calls `requireAuth()` through `runAction`
  because actions are reachable by direct POST; the download route checks the session itself.
- Rotating `SESSION_SECRET` invalidates all sessions.
- Rationale & limits: [ADR-006](../decisions/adr-006-single-user-authentication.md).

## Protected Server Actions

- Authentication as above, plus Zod validation of every argument on the server
  (client validation is only for UX).
- Next.js rejects Server Action POSTs whose `Origin` differs from the host (CSRF protection).
- Actions return typed results; unexpected errors are replaced by a generic message so stack
  traces and internals never reach the browser.

## Secrets and credentials

- AWS credentials are read only by the AWS SDK on the server (default provider chain). No
  `NEXT_PUBLIC_*` variables exist; nothing secret is bundled for the browser.
- `lib/env.ts`, `lib/db.ts`, `lib/email/ses.ts`, services and storage import `"server-only"`,
  so importing them into a Client Component fails the build.
- The Settings page shows only whether keys are present — never their values.
- `.env*` is gitignored (except `.env.example` with placeholders and `.env.test` with local
  Docker-only credentials).
- Production: prefer an **IAM role** over long-lived keys ([aws/iam.md](../aws/iam.md)).

## No secrets in logs

`lib/logger.ts` emits JSON lines and redacts any context key matching
`password|secret|token|authorization|cookie|accesskey|credential|body|html|text`.
The SES error path logs only the AWS error name and message, never the request (which
contains the email body and attachments). Env validation errors log variable names, not values.

## Input validation

- Zod schemas in `lib/**/schemas.ts` and `lib/validation/common.ts`; shared by client and server.
- Lengths are capped to match column sizes; emails, URLs (http/https only — no `javascript:`),
  dates, enums and ID lists are validated.
- URL query parameters for the list page are whitelisted (`lib/applications/query.ts`): unknown
  sort fields, statuses or page sizes fall back to defaults.
- Prisma parameterises all queries; the only raw SQL (`getMonthlyTrend`) uses tagged-template
  parameters.

## File validation and size restrictions

- Allowed: PDF, DOCX, DOC. Checked by **extension and magic bytes** (`lib/documents/validation.ts`) —
  a renamed `.exe` is rejected.
- Maximum 5 MB per file (checked in the browser, again in the action before buffering, and in
  the service). Server Action body limit is 6 MB (`next.config.ts`).
- Stored outside `public/` under a random UUID key; the user-supplied filename is sanitised and
  kept only as metadata. Path traversal is blocked in `lib/storage/local.ts`.
- Served only through the authenticated download route with `X-Content-Type-Options: nosniff`
  and `Content-Disposition` (inline only for PDFs).

## HTML sanitization

- Outgoing email HTML is sanitised server-side with `sanitize-html` before it is stored or sent
  (`lib/email/sanitize.ts`): only formatting tags; no scripts, styles, event handlers, iframes,
  forms or images; links limited to http/https/mailto with `rel="noopener noreferrer"`.
- Stored email HTML is displayed in an `<iframe sandbox="">` (no scripts, no same-origin
  access) — defence in depth even if sanitisation missed something.
- Templates are plain text; text → HTML conversion escapes all HTML characters.

## Email abuse protection

- **Explicit confirmation** dialog before every send.
- **Rate limit:** `EMAIL_RATE_LIMIT_PER_HOUR` (default 20), counted in the database so it holds
  across restarts and instances.
- **Duplicate-send prevention:** unique idempotency key per composer session; in-flight guard;
  explicit re-confirmation to email the same recipient again. See
  [features/email-sending.md](../features/email-sending.md#duplicate-send-prevention).
- `mock` transport is refused when `NODE_ENV=production`.

## Webhook security

`/api/webhooks/ses` is public by necessity. It accepts only SNS messages whose RSA signature
verifies against a certificate downloaded from `https://sns.<region>.amazonaws.com/…pem`,
optionally restricted to `SES_SNS_TOPIC_ARN`, with a 256 KB body limit. It can only move an
email's delivery status forward; it cannot read data.

## Secure database access

- Use a dedicated MySQL user with privileges on the JobTrack database only
  (`SELECT, INSERT, UPDATE, DELETE` at runtime; DDL only for the migration user).
- Use TLS to remote databases where available.
- Foreign keys and cascade rules keep data consistent ([database/relationships.md](../database/relationships.md)).

## HTTP security headers

`next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and
removes `X-Powered-By`. HTTPS/HSTS are terminated at the reverse proxy
([deployment/production.md](../deployment/production.md#https)).

## Known limitations

- Login throttling is per-process memory; behind several instances use a shared store (Redis).
- No multi-user accounts, roles or 2FA (single-user by design for now).
- Uploaded files are not virus-scanned; only type/size are enforced.
- No Content-Security-Policy header yet (planned; requires nonce support for Next.js scripts).
