# Decision

ADR-006: Protect the app with single-user password authentication and HMAC-signed session cookies.

Status: Accepted · Date: 2026-10-01

## Context

JobTrack holds personal data and can send email in the owner's name, so it must not be usable
by anyone who finds the URL. The first version has exactly one user. Server Actions are
reachable by direct POST, so every one needs an authorisation check.

## Problem

What is the simplest authentication that is secure enough for one user and does not block a
future multi-user SaaS?

## Options Considered

1. **Password from env + stateless signed cookie** (no user table).
2. Auth.js / NextAuth with an OAuth provider.
3. A full user/session model in the database.
4. Rely on network-level protection only (VPN, basic auth at the proxy).

## Decision

Option 1: `APP_PASSWORD` + `SESSION_SECRET`.
- `lib/auth/token.ts`: token `v1.<expiresAt>.<HMAC-SHA256>` via Web Crypto; constant-time compares.
- Cookie `jobtrack_session`: HttpOnly, SameSite=Lax, Secure in production, 7 days.
- `proxy.ts` gates every request (except `/login`, `/api/webhooks/ses`, `/api/health`).
- `requirePageAuth()` in the app layout and `requireAuth()` in every Server Action (`runAction`)
  and in the download route — defence in depth.
- Per-IP login throttling (5 failures / 15 min, in memory).

## Reasons

- No external dependency or database table; tiny, auditable code.
- Works in `proxy.ts`, Server Components, Server Actions and tests alike.
- Follows the Next.js guidance to verify auth inside each Server Function.

## Consequences

- One shared password, no per-user audit trail, no 2FA.
- Changing the password does not end sessions; rotate `SESSION_SECRET` to log everyone out.
- Login throttling resets on restart and is per instance.

## Future Considerations

For SaaS: introduce a `User` model and Auth.js (OAuth + email), database or Redis-backed
sessions, 2FA, and scope every query by `userId`. The `requireAuth()` call sites become
`requireUser()` returning the user.
