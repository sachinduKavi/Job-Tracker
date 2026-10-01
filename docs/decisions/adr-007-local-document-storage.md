# Decision

ADR-007: Store uploaded documents on the local filesystem behind a minimal storage interface.

Status: Accepted · Date: 2026-10-01

## Context

CVs and cover letters must be stored, downloaded and attached to emails. The first deployment is
a single server; there is no requirement for multiple instances yet.

## Problem

Where should uploaded files live?

## Options Considered

1. **Local filesystem** (`STORAGE_DIR`) outside `public/`.
2. Amazon S3 (with pre-signed URLs).
3. Database BLOB columns.

## Decision

Local filesystem through `lib/storage/local.ts` exposing only `putObject`, `getObject` and
`removeObject` by key. Keys are `YYYY/MM/<uuid>.<ext>`. Files are served only by the authenticated
`/api/documents/[id]/download` route.

## Reasons

- Zero extra infrastructure or IAM permissions; works identically in development and on a VM.
- Random keys + resolved-path check eliminate traversal and collisions.
- Keeping files out of MySQL keeps the database small and backups fast.
- The three-function interface makes an S3 implementation a drop-in replacement.

## Consequences

- Requires a persistent, backed-up volume; not suitable for serverless/ephemeral hosts.
- Not shared between multiple app instances.
- Database and storage backups must be coordinated.

## Future Considerations

Add `lib/storage/s3.ts` with the same interface, choose the backend by env var, migrate existing
files by copying keys 1:1, and serve downloads via short-lived pre-signed URLs. That also requires
`s3:GetObject/PutObject/DeleteObject` on one bucket prefix for the app's IAM role.
