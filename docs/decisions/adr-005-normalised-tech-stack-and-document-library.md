# Decision

ADR-005: Normalise the tech stack into its own table, and model documents as a reusable library
linked to applications.

Status: Accepted · Date: 2026-10-01

## Context

The specification listed `Application.techStack` as a field and `Document.applicationId` /
`Document.url` as document columns. The product requirements also ask for analytics *by
technology*, search by tech stack, and "multiple CVs" (Backend, Full Stack, .NET, …) that can be
selected and attached to any application.

## Problem

How to store (a) a list of technologies per application on MySQL, and (b) documents that are
reused across many applications?

## Options Considered

Tech stack:
1. Comma-separated string column.
2. JSON column.
3. **Child table `ApplicationTechnology (applicationId, name)`**.

Documents:
1. Document belongs to one application (`Document.applicationId`) — upload the same CV again for every application.
2. **Library `Document` + link table `ApplicationDocument (applicationId, documentId, role)`**.

## Decision

- `ApplicationTechnology` child table, unique per (application, name), indexed by name. Exposed as
  the `techStack` relation; the form still accepts a comma-separated input.
- `Document` is a library entry (no `applicationId`); `ApplicationDocument` links documents to
  applications with a role (`CV`, `COVER_LETTER`, `ADDITIONAL`).
- `Document.storageKey` instead of `url`: files are private and served by an authenticated route
  (ADR-007), so there is no public URL to store.
- `EmailAttachment` snapshots (filename, type, size, nullable `documentId`) record what was
  actually sent, even if the document is later renamed or deleted.

## Reasons

- Prisma has no scalar lists on MySQL; a child table gives indexed `GROUP BY name` for analytics
  and `some: { name: { contains } }` search without JSON functions.
- A CV is uploaded once and reused; the default CV per type is preselected; deleting an
  application never deletes your CV.
- Email history stays truthful.

## Consequences

- Slightly more tables and joins; updates replace the technology rows in a transaction.
- Technology names are free text ("React" vs "React.js" are different entries; case is grouped by
  the collation).

## Future Considerations

A canonical `Technology` table with aliases; per-application private uploads if needed (a link
with role `ADDITIONAL` already covers most cases).
