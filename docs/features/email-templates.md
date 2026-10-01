# Email Templates

## Purpose

Reuse well-written application emails and personalise them automatically.

## User Flow

- **Email Templates (`/templates`)** — cards with name, subject and a rendered preview.
  **New template** / ✎ edit opens a dialog with name, subject and body, buttons to insert each
  variable at the cursor, and a live preview with sample values. 🗑 deletes after confirmation.
- **Use a template** — in the application form ("Fill from template") or in the email composer
  ("Template"). The rendered subject/body replace the current ones and can then be edited.

## Variables

| Variable | Value |
| --- | --- |
| `{{company}}` | Application company |
| `{{position}}` | Application position |
| `{{location}}` | Application (job) location |
| `{{name}}` | Settings → Profile → Full name |
| `{{email}}` | Settings → Profile → Email |
| `{{phone}}` | Settings → Profile → Phone |

Example:

```text
Subject:
Application for {{position}} at {{company}}

Dear Hiring Team,

I am writing to apply for the {{position}} position at {{company}}.

Please find my CV attached for your consideration.

Best regards,
{{name}}
```

## Architecture & Implementation

- `lib/templates/render.ts` (pure, runs in the browser and on the server):
  - Pattern `{{ name }}` (whitespace inside braces allowed).
  - Known variable with a value → replaced. Known variable without a value → replaced by an
    empty string and reported in `missing` (the UI shows a warning toast).
  - Unknown variable (e.g. `{{recruiter}}`) → **left as-is** and reported in `unknown`, so typos
    are visible in the preview.
  - Replacement is single-pass: values are never re-interpreted as template syntax.
  - `renderEmailTemplate` renders subject + body and collapses whitespace in the subject.
- Templates are **plain text**. In the composer the rendered body becomes the "Body" text, which
  is converted to HTML (escaped, paragraphs, links) — so template content cannot inject HTML.
- `lib/templates/service.ts` — CRUD; unique name (`P2002` → `CONFLICT`).
- UI: `components/templates/*`, `app/(app)/templates/page.tsx`.

## Database Changes

`EmailTemplate` (`name` unique, `subject`, `body` TEXT); `Profile` for personal variables.

## Server Actions / API

`saveTemplateAction(id | null, values)` (create or update), `deleteTemplateAction(id)`,
`updateProfileAction(values)`.

## Validation

`templateFormSchema`: name ≤ 120, subject ≤ 500, body ≤ 20 000, all required.
Profile: optional fields, valid email.

## Security

Plain-text templates; HTML escaping on conversion; authenticated actions.

## Testing

`tests/unit/template-render.test.ts` (replacement, whitespace, missing, unknown, no double
substitution); `tests/integration/documents-templates-analytics.test.ts` (CRUD, unique names).

## Error Handling

Duplicate name → field error "Name must be unique". Missing values → warning toast listing
the variables.

## Known Limitations

No rich-text editor; no conditional blocks or default values in templates.

## Future Improvements

Default values (`{{name|Hiring Team}}`), per-template default attachments, AI-assisted drafting.
