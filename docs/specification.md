# JobTrack — Product & Engineering Specification

> Source of truth for the project's requirements. Implementation phases and
> deliverables below are tracked against this document.

Build a production-quality **Job Application Tracker and Email Application Management System** using **Next.js full-stack architecture**.

The application is intended for personal use initially, but the architecture must be clean and scalable enough to evolve into a SaaS product later.

The system should allow me to:

- Track all job applications.
- Store company and job information.
- Send job application emails directly from the application.
- Use Amazon SES for sending emails.
- Attach my CV and cover letter.
- Track email delivery status.
- Track job application status.
- Maintain a complete timeline/history of every application.
- Manage email templates.
- Manage CVs and other documents.
- View application analytics.
- Search and filter applications.
- Document every important development and operational process.

---

# 1. Technology Stack

Use:

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- MySQL
- Prisma ORM
- Amazon SES
- AWS SDK for JavaScript
- Zod
- React Hook Form
- Lucide React

Use Next.js as the full-stack application.

Do NOT introduce NestJS for the initial version.

Use:

```text
Next.js
├── React UI
├── Server Components
├── Server Actions
├── Route Handlers
├── Prisma
├── MySQL
└── Amazon SES
```

Keep server-side business logic separate from UI components so that a dedicated backend such as NestJS can be introduced later if the project grows.

---

# 2. Critical Requirement — Documentation

Documentation is a **first-class requirement of this project**.

Do not only write the application code.

Document the entire engineering process.

Every major feature, architectural decision, setup process, deployment process, AWS configuration, database change, and operational procedure must be documented.

Create a dedicated `docs/` directory. The documentation should be written in Markdown.

---

# 3. Documentation Structure

```text
docs/
│
├── README.md
│
├── architecture/
│   ├── overview.md
│   ├── application-architecture.md
│   ├── data-flow.md
│   ├── email-flow.md
│   └── security.md
│
├── setup/
│   ├── local-development.md
│   ├── environment-variables.md
│   ├── database-setup.md
│   └── aws-setup.md
│
├── database/
│   ├── schema.md
│   ├── relationships.md
│   └── migrations.md
│
├── features/
│   ├── applications.md
│   ├── email-sending.md
│   ├── email-templates.md
│   ├── documents.md
│   ├── status-tracking.md
│   └── analytics.md
│
├── aws/
│   ├── ses.md
│   ├── iam.md
│   └── email-events.md
│
├── development/
│   ├── coding-guidelines.md
│   ├── git-workflow.md
│   ├── testing.md
│   └── troubleshooting.md
│
├── deployment/
│   ├── production.md
│   ├── environment-configuration.md
│   └── rollback.md
│
└── decisions/
    ├── adr-001-nextjs-fullstack.md
    ├── adr-002-mysql-prisma.md
    └── adr-003-amazon-ses.md
```

The exact structure can be adjusted if necessary, but documentation must remain organized and easy to navigate.

---

# 4. Documentation Rules

Whenever implementing a major feature:

1. Implement the feature.
2. Document how it works.
3. Document why the implementation was chosen.
4. Document configuration requirements.
5. Document how to test it.
6. Document common failures.
7. Update the main documentation index.

Do not create documentation that describes functionality that does not actually exist.

Documentation must match the current implementation.

If implementation changes, update the relevant documentation.

---

# 5. Architecture Documentation

Create an architecture overview explaining:

```text
User
 │
 ▼
Next.js Application
 │
 ├── UI
 │
 ├── Server Actions
 │
 ├── Route Handlers
 │
 ├── Business Logic
 │
 ├── Prisma
 │
 ▼
MySQL
 │
 └── Application Data


Next.js Server
 │
 ▼
Amazon SES
 │
 ▼
Employer
```

Explain:

- Why Next.js was selected.
- Why a separate NestJS backend is not initially required.
- How server-side code is separated from client-side code.
- How database access works.
- How AWS SES integration works.
- How authentication/security is handled.
- How the system can later evolve into a separate backend architecture.

---

# 6. Architecture Decision Records

Use ADRs for important technical decisions.

Each ADR should contain:

```text
# Decision

## Context

## Problem

## Options Considered

## Decision

## Reasons

## Consequences

## Future Considerations
```

Create ADRs for at least:

- **ADR-001** — Why Next.js full-stack architecture is being used instead of NestJS initially.
- **ADR-002** — Why MySQL + Prisma is being used.
- **ADR-003** — Why Amazon SES is being used for email sending.
- **ADR-004** — Why application status and email delivery status are separate concepts.

Add additional ADRs when significant architectural decisions are made.

---

# 7. Main Dashboard

Create a modern dashboard for managing job applications.

The primary table should contain:

| Application ID | Date Applied | Company | Position | Tech Stack | Location | Status | Source |
|---|---|---|---|---|---|---|---|

Example:

| APP-0001 | Oct 1, 2026 | Veyrion | Associate Software Engineer | C#, .NET, React | Colombo | Applied | LinkedIn |
|---|---|---|---|---|---|---|---|
| APP-0002 | Sep 30, 2026 | Rootcode | Software Engineer Intern | React, Node.js | Remote | Interview | Company Website |

Support:

- Search
- Filtering
- Sorting
- Pagination
- Status filtering
- Source filtering
- Date filtering
- Company filtering
- Position filtering

Each row should have:

- View
- Edit
- Send Email
- Change Status
- Delete

Document the dashboard architecture in `docs/features/applications.md`.

---

# 8. Application Statuses

Initial statuses:

```text
Draft
Applied
Acknowledged
HR Screening
Technical Interview
Final Interview
Offer
Rejected
Withdrawn
No Response
```

Use reusable status configuration.

Do not scatter status strings throughout the codebase.

Document the status lifecycle.

```text
Draft
  ↓
Applied
  ↓
Acknowledged
  ↓
HR Screening
  ↓
Technical Interview
  ↓
Final Interview
  ↓
Offer
```

Rejected/Withdrawn/No Response can occur from appropriate stages.

---

# 9. Application Creation

Create `/applications/new`.

Form fields:

### Basic Information

- Company Name
- Position
- Application Date
- Location
- Job URL
- Source
- Tech Stack
- Status
- Notes

### Email

- Recipient Email
- CC
- BCC
- Email Subject
- Email Body

### Documents

- CV
- Cover Letter
- Additional Documents

Use:

- React Hook Form
- Zod
- Server-side validation

Document the complete application creation process.

---

# 10. Application Details

Create `/applications/[id]`.

Display:

## Application Information

- Application ID
- Company
- Position
- Tech Stack
- Location
- Source
- Job URL
- Current Status
- Date Applied
- Last Updated

## Email

- Recipient
- CC
- BCC
- Subject
- Body
- Sent date
- SES Message ID
- Email delivery status

## Documents

- CV
- Cover Letter
- Additional documents

## Timeline

```text
Oct 01
Application created

Oct 01
Application email sent

Oct 01
Email delivered

Oct 05
Status changed to HR Screening

Oct 08
Technical interview scheduled
```

Every important application event should be stored.

Document the timeline/event system.

---

# 11. Amazon SES

Use Amazon SES for sending emails. Use AWS SDK.

Credentials must ONLY be available server-side.

Environment variables:

```env
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=
```

Never expose credentials to the browser. Never commit secrets to Git.

Document AWS SES setup in `docs/aws/ses.md`. The documentation must explain:

- Creating/configuring SES.
- Verifying the sender identity.
- SES sandbox considerations.
- Moving out of SES sandbox.
- IAM permissions.
- Required environment variables.
- Sending a test email.
- Troubleshooting SES failures.
- Production security recommendations.

Do not include real credentials in documentation. Use placeholders.

---

# 12. SES Email Service

Create `lib/email/ses.ts` providing functionality such as `sendApplicationEmail()`.

Support:

- To
- CC
- BCC
- Subject
- HTML
- Plain text
- Attachments

After successfully sending:

1. Store SES Message ID.
2. Store sent timestamp.
3. Update email status.
4. Change `Draft` → `Applied`.
5. Create an application event.
6. Display success notification.

Document this complete flow.

---

# 13. Email Composer

Create a professional email composer.

Features:

- Recipient
- CC
- BCC
- Subject
- HTML body
- Plain text fallback
- Attachments
- Preview
- Send

Before sending:

```text
Send application?

Company:
Veyrion

Position:
Associate Software Engineer

To:
people@company.com

Attachment:
Sachindu_Kavishka_CV.pdf

[Cancel] [Send Application]
```

Require explicit user confirmation. Document the send process.

---

# 14. Email Templates

Create an email template management system.

Support variables:

```text
{{company}}
{{position}}
{{name}}
{{email}}
{{phone}}
{{location}}
```

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

Allow:

- Create template
- Edit template
- Delete template
- Select template
- Preview template

Document template processing.

---

# 15. CV and Document Management

Allow multiple CVs:

```text
Backend Developer CV
Full Stack Developer CV
.NET Developer CV
DevOps CV
General Software Engineer CV
```

Support:

- Upload
- Rename
- Delete
- Default CV
- Select CV
- Attach to email

Document:

- Supported file types
- Maximum size
- Storage strategy
- Upload flow
- Security considerations

---

# 16. Database

Use MySQL 8 + Prisma (InnoDB, utf8mb4).

MySQL-specific notes:

- Prisma does not support scalar lists (`String[]`) on MySQL. Store `techStack` as a normalized relation or a JSON column, and record the choice in an ADR.
- `mode: "insensitive"` is not available on MySQL. Case-insensitive search relies on the case-insensitive `_ci` collation (Prisma creates tables with `utf8mb4_unicode_ci`).
- Prisma `String` maps to `VARCHAR(191)`. Use `@db.Text` for email bodies, notes and template bodies.
- Store event metadata in a `Json` column (MySQL 8 native JSON).

Models: `Application`, `Email`, `Document`, `StatusHistory`, `EmailTemplate`, `ApplicationEvent`.

**Application**: id, applicationId, company, position, techStack, location, status, source, jobUrl, recipientEmail, cc, bcc, notes, dateApplied, createdAt, updatedAt

**Email**: id, applicationId, to, cc, bcc, subject, body, sesMessageId, emailStatus, sentAt, createdAt

**Document**: id, applicationId, name, type, url, mimeType, size, createdAt

**StatusHistory**: id, applicationId, fromStatus, toStatus, note, createdAt

**EmailTemplate**: id, name, subject, body, createdAt, updatedAt

**ApplicationEvent**: id, applicationId, eventType, description, metadata, createdAt

Use:

- Proper indexes
- Foreign keys
- Constraints
- Cascading rules
- Appropriate data types

Document the database schema and relationships.

---

# 17. Database Migration Documentation

Whenever the schema changes:

1. Create a Prisma migration.
2. Explain what changed.
3. Explain why it changed.
4. Document migration commands.
5. Update `docs/database/schema.md`.

Include:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Explain development vs production migrations.

---

# 18. Email Delivery Tracking

Support: `Sent`, `Delivered`, `Bounced`, `Complaint`.

Keep **Application Status** separate from **Email Delivery Status**.

```text
Application:
Applied

Email:
Delivered
```

Do not assume email delivery means the employer has reviewed the application.

Document this distinction.

---

# 19. Analytics

Dashboard statistics:

```text
Total Applications
Applications This Month
Interviews
Offers
Rejected
No Response
```

Charts:

- Applications by Status
- Applications over Time
- Applications by Source
- Applications by Technology
- Applications by Location

Document how analytics are calculated.

---

# 20. Search and Filtering

Search: Company, Position, Tech Stack, Location, Application ID

Filters: Status, Source, Date range, Location

Sorting: Date, Company, Position, Status

Use URL query parameters where appropriate. Document the filtering strategy.

---

# 21. Security

Implement:

- Server-side AWS credentials.
- Input validation.
- File validation.
- File size restrictions.
- HTML sanitization.
- Rate limiting for email sending.
- Duplicate-send prevention.
- Secure environment variables.
- No secrets in Git.
- No secrets in logs.
- Protected server actions.
- Secure database access.

Create `docs/architecture/security.md`. Document all security decisions.

---

# 22. UI/UX

Create a polished SaaS-style UI.

Use:

- shadcn/ui
- Tailwind
- Lucide
- Responsive layouts
- Dark/light mode
- Toast notifications
- Confirmation dialogs
- Loading states
- Skeleton states
- Empty states
- Error states

Sidebar:

```text
JobTrack

Dashboard
Applications
Email Templates
Documents
Analytics
Settings
```

---

# 23. Application ID

Use human-readable IDs: `APP-0001`, `APP-0002`, `APP-0003`.

Use UUID/CUID internally. Document the ID strategy.

---

# 24. Testing

Testing is mandatory.

### Unit Tests

- Email template replacement
- Status transitions
- Validation
- Application ID generation
- Email payload generation

### Integration Tests

- Creating an application
- Updating status
- Database operations
- Email service behavior

### End-to-End Tests

Critical workflow:

```text
Create Application
        ↓
Select CV
        ↓
Compose Email
        ↓
Preview
        ↓
Confirm
        ↓
Send through SES
        ↓
Store SES Message ID
        ↓
Application becomes Applied
```

Document in `docs/development/testing.md`.

---

# 25. Git Workflow

Document the recommended Git workflow.

```text
main
 │
 ├── feature/application-crud
 ├── feature/email-ses
 ├── feature/templates
 └── feature/analytics
```

Use meaningful commit messages. Document branch naming, commit conventions, pull requests, release process in `docs/development/git-workflow.md`.

---

# 26. Environment Configuration

Create `.env.example`. Never create `.env` with real secrets.

```env
DATABASE_URL=

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

SES_FROM_EMAIL=
```

Document every environment variable (Variable, Purpose, Required, Example, Security considerations) in `docs/setup/environment-variables.md`.

---

# 27. Local Development Documentation

Create a complete guide from zero:

1. Required Node.js version.
2. Installing dependencies.
3. Creating MySQL database.
4. Configuring `.env`.
5. Running Prisma migrations.
6. Generating Prisma client.
7. Running seed data.
8. Starting development server.
9. Testing email functionality.

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

The guide must allow another developer to clone the repository and run the project without asking the original developer for undocumented steps.

---

# 28. AWS Documentation

Document AWS configuration step-by-step:

```text
AWS Account
    ↓
IAM User/Role
    ↓
SES
    ↓
Verified Identity
    ↓
Permissions
    ↓
Environment Variables
    ↓
Next.js Server
    ↓
SES SendEmail
```

Document the minimum IAM permissions required. Do not use overly broad permissions such as full administrator access unless absolutely necessary.

---

# 29. Deployment

Document production deployment in `docs/deployment/production.md`:

- Build process
- Environment variables
- Database migration
- AWS configuration
- SES production configuration
- Domain configuration
- HTTPS
- Logging
- Monitoring
- Rollback procedure

---

# 30. Troubleshooting

Create a troubleshooting guide covering:

- **Database**: Can't connect to MySQL; Prisma migration failed; Prisma client outdated
- **SES**: Email not sending; Email address not verified; SES sandbox restrictions; AccessDenied; MessageRejected; Invalid credentials
- **Application**: File upload failure; Server Action failure; Validation failure; Duplicate email

For each issue document: Symptom, Possible Cause, Solution, Verification.

---

# 31. Development Process Documentation

Maintain `docs/development/changelog.md`. For every major feature record: Date, Feature, Problem, Implementation, Files Changed, Database Changes, Testing, Documentation Updated.

Example:

```text
## 2026-10-01

### Feature
Amazon SES email sending

### Problem
Need to send job application emails directly from the application.

### Implementation
Created server-side SES service using AWS SDK.

### Database Changes
Added Email model and sesMessageId.

### Testing
Successfully tested with verified SES recipient.

### Documentation
Updated:
- docs/aws/ses.md
- docs/features/email-sending.md
- docs/architecture/email-flow.md
```

---

# 32. Feature Documentation Template

```markdown
# Feature Name

## Purpose

## User Flow

## Architecture

## Implementation

## Database Changes

## Server Actions / API

## Validation

## Security

## Testing

## Error Handling

## Known Limitations

## Future Improvements
```

---

# 33. README

Root `README.md` sections: JobTrack (title + tagline), Features, Architecture, Tech Stack, Project Structure, Prerequisites, Installation, Environment Variables, Database Setup, AWS SES Setup, Running Locally, Testing, Deployment, Documentation, Contributing, License. Include links to the documentation files. The README should be the starting point for any developer.

---

# 34. Future Architecture

Design the code so it can eventually evolve into:

```text
                    ┌──────────────┐
                    │   Next.js    │
                    │   Frontend   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    API       │
                    │  Next/Nest   │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          MySQL           SES          Redis
```

Potential future features (do NOT implement now unless explicitly requested): mobile application, browser extension, Gmail integration, Outlook integration, AI-generated emails, AI cover letters, job description parsing, CV matching, interview management, follow-up reminders, recruiter management, automated notifications, public API.

Document future architecture considerations.

---

# 35. Implementation Process

Follow these phases; update documentation after each.

1. **Foundation** — Next.js, TypeScript, Tailwind, shadcn/ui, MySQL, Prisma, project structure, environment configuration, documentation foundation.
2. **Application Management** — CRUD, table, details, status management, status history, search, filtering, timeline.
3. **Documents** — CV management, cover letters, file validation, file attachments.
4. **Email Templates** — template CRUD, variables, preview, email composer.
5. **Amazon SES** — AWS SDK, SES service, sending, attachments, SES Message ID, email status, error handling.
6. **Analytics** — dashboard metrics, status/source/technology analytics, trends.
7. **Testing** — unit, integration, E2E.
8. **Production** — production environment, database migration, AWS configuration, SES production setup, deployment, monitoring, rollback.

---

# 36. Important Development Rules

1. Do not put business logic directly inside UI components.
2. Do not expose AWS credentials.
3. Do not hard-code secrets.
4. Do not create unnecessary abstractions.
5. Keep modules cohesive.
6. Use strict TypeScript.
7. Validate on both client and server where appropriate.
8. Handle errors explicitly.
9. Write reusable components.
10. Keep database operations in dedicated server-side modules.
11. Keep AWS integration isolated.
12. Write tests for critical business logic.
13. Document significant architectural decisions.
14. Update documentation whenever implementation changes.
15. Never document functionality that has not been implemented.
16. Keep the documentation synchronized with the codebase.
17. Prefer simple architecture initially.
18. Avoid introducing NestJS unless there is a demonstrated architectural need.

---

# 37. Final Deliverables

- **Application**: fully functional Next.js app, application CRUD, dashboard, status tracking, timeline, email templates, CV management, Amazon SES integration, email tracking, analytics, search/filtering, responsive UI.
- **Database**: Prisma schema, migrations, seed data, proper relationships, indexes.
- **AWS**: SES integration, IAM guidance, email configuration, delivery tracking architecture.
- **Documentation**: `README.md` plus `docs/` with architecture, setup, database, features, aws, development, deployment, decisions.
- **Tests**: unit, integration, E2E for critical flows.
- **Configuration**: `.env.example`.

---

# 38. Final Instruction

Treat documentation as part of the product, not as an afterthought.

For every implementation step, answer internally: What are we building? Why this way? How does it work? What changed? How is it tested? How is it configured? How can another developer reproduce it? What could fail? How can it be maintained?

The final repository should allow another developer to understand the entire system, set it up locally, configure AWS SES, run the database, test the application, deploy it, troubleshoot common problems, and understand the reasoning behind the architecture without needing undocumented knowledge from the original developer.
