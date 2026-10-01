# Documents (CVs, Cover Letters, Other Files)

## Purpose

Keep several CVs (Backend, Full Stack, .NET, DevOps, General…), cover letters and other files
in one library and attach the right ones to each application email.

## User Flow

- **Documents (`/documents`)** — grouped by type (CV / Résumé, Cover Letter, Other). Each row
  shows name, original filename, size, upload date, how many applications use it and a
  **Default** badge. Menu: **Open**, **Rename**, **Set as default**, **Delete**.
- **Upload document** dialog: file, name (prefilled from the filename), type, "Use as default".
- **Select** — the application form has CV and Cover letter selects (default preselected) and
  checkboxes for additional documents; the composer lists all documents as attachments.

## Supported file types and size

| Type | Extensions | Detected by |
| --- | --- | --- |
| PDF | `.pdf` | `%PDF-` |
| Word | `.docx` | ZIP header `PK\x03\x04` |
| Word 97-2003 | `.doc` | OLE2 header `D0 CF 11 E0 A1 B1 1A E1` |

- **Maximum size: 5 MB per file** (`MAX_DOCUMENT_SIZE_BYTES`). Server Action body limit: 6 MB.
- Email attachments: up to 10 files, **15 MB total**.

## Architecture

```text
UploadDocumentDialog (client: extension/size pre-check)
  → uploadDocumentAction(FormData)               app/actions/documents.ts
      size check before buffering → documentMetaSchema
      → uploadDocument()                          lib/documents/service.ts
           validateDocumentFile (magic bytes)     lib/documents/validation.ts
           putObject(bytes, ext) → storageKey     lib/storage/local.ts
           transaction: clear other defaults of the type (if needed) → INSERT Document
           (file removed again if the DB insert fails)
Download: GET /api/documents/[id]/download → getDocumentWithContent → bytes
```

## Storage strategy

- Local filesystem under `STORAGE_DIR` (default `./storage/uploads`, gitignored), **outside**
  `public/`, so files are never directly reachable.
- Key format `YYYY/MM/<uuid>.<ext>`; user filenames are never used as paths (prevents
  collisions and path traversal). The sanitised original filename is stored as metadata and
  used as the attachment filename.
- Files are served only by the authenticated download route
  (`Content-Disposition: attachment`, or `inline` for PDFs with `?inline=1`; `nosniff`; `no-store`).
- Back up `STORAGE_DIR` together with the database.
- Why local storage and how to move to S3: [ADR-007](../decisions/adr-007-local-document-storage.md).

## Implementation details

- **Default per type:** the first document of a type becomes the default automatically;
  uploading with "Use as default" or **Set as default** clears the previous default in the same
  transaction; deleting the default promotes the newest remaining document of that type.
- **Rename** changes only the display name.
- **Delete** removes the row, its application links (cascade) and the file; email attachment
  snapshots keep filename/type/size with `documentId = NULL`.

## Database Changes

`Document`, `ApplicationDocument`, `EmailAttachment`. See [schema.md](../database/schema.md).

## Server Actions / API

`uploadDocumentAction(FormData{file,name,type,isDefault})`, `renameDocumentAction({id,name})`,
`setDefaultDocumentAction(id)`, `deleteDocumentAction(id)`,
`GET /api/documents/[id]/download[?inline=1]`.

## Validation

Browser: extension + size. Server: size (before reading), name/type/default (Zod), extension in
the allow-list **and** matching magic bytes, non-empty. MIME type is derived from the validated
type, not from the browser.

## Security considerations

- Content sniffing defeats renamed executables; files are never executed or rendered by the app
  (PDF inline display is done by the browser's PDF viewer with `nosniff`).
- No public URLs; authentication required for download.
- Path traversal is impossible (random keys + resolved-path check).
- Not virus-scanned (see limitations).

## Testing

Unit: `validateDocumentFile`, `sanitizeFilename` (`tests/unit/validation.test.ts`).
Integration: upload/default handling/rename/read/delete/file removal and disguised-file
rejection (`tests/integration/documents-templates-analytics.test.ts`). E2E: upload a CV and
attach it to a sent email.

## Error Handling

"Unsupported file type…", "File is larger than 5 MB", "File content does not match its
extension", "The file for X is missing from storage" (404 on download).

## Known Limitations

- Single-server local storage (not shared between instances; ephemeral on some PaaS).
- No virus scanning, no versioning, no preview thumbnails.

## Future Improvements

S3 backend with pre-signed URLs, ClamAV scanning, document versions, per-application uploads
directly from the form.
