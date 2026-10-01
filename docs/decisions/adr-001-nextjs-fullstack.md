# Decision

ADR-001: Use a Next.js full-stack architecture (no separate NestJS backend) for the initial version.

Status: Accepted · Date: 2026-10-01

## Context

JobTrack starts as a personal, single-user tool with one web client. It must still be built so
that it can become a SaaS (more users, more clients, background jobs) later.

## Problem

Where should server-side logic (database access, SES sending, validation, business rules) live,
and how many deployables should the first version have?

## Options Considered

1. **Next.js full-stack** — UI, Server Components, Server Actions and Route Handlers in one app;
   business logic in plain TypeScript modules.
2. **Next.js frontend + NestJS API** — two apps, REST/GraphQL between them.
3. **Next.js + serverless functions (Lambda)** for the backend.

## Decision

Option 1. One Next.js 16 application. Business logic lives in framework-agnostic modules under
`lib/` (services take typed inputs and throw `AppError`); Server Actions and Route Handlers are
thin adapters.

## Reasons

- One codebase, one deployment, one type system; Zod schemas and status configuration are shared
  by UI and server without an API contract.
- Server Components render data on the server — fast pages without client-side fetching code.
- Server Actions provide typed mutations with built-in same-origin (CSRF) checks.
- No demonstrated need for NestJS's features (DI container, modules, microservices) yet; it
  would add a second service to secure, deploy and version.
- Keeping logic out of Next.js-specific code preserves the option to extract an API later.

## Consequences

- + Faster development; simpler local setup and deployment.
- + `server-only` guard enforces the server/client boundary at build time.
- − Server Actions are an RPC mechanism tied to this Next.js app; other clients (mobile, extension)
  cannot call them — they would need Route Handlers or a separate API.
- − Background work (queues, schedules) has no natural home yet; sending is synchronous.

## Future Considerations

Introduce `/api/v1` Route Handlers or a NestJS service wrapping `lib/**/service.ts` when a second
client, a public API or background processing appears.
See [future-architecture.md](../architecture/future-architecture.md).
