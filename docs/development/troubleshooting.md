# Troubleshooting

Each entry: **Symptom → Possible cause → Solution → Verification.**
Server logs are JSON lines (`"event": "…"`) on stdout/stderr.

## Database

### Can't connect to MySQL

- **Symptom:** pages show "Something went wrong"; `/api/health` returns 503
  `{"database":"unreachable"}`; logs show `ECONNREFUSED`, `ETIMEDOUT`, `Access denied for user` or
  `pool timeout`.
- **Possible cause:** MySQL not running; wrong host/port (Docker uses **3307**); wrong
  credentials; special characters in the password not URL-encoded; firewall/security group;
  remote user not allowed from your IP (`'user'@'%'`).
- **Solution:** `docker compose up -d` and wait for *healthy*; fix `DATABASE_URL`
  (`encodeURIComponent` the password); allow your IP on the server; restart `npm run dev`.
- **Verification:** `npx prisma migrate status` connects; `curl localhost:3000/api/health` → `"database":"ok"`.

### Prisma migration failed

- **Symptom:** `prisma migrate dev`/`deploy` exits with an error, e.g. `P3014` (shadow
  database), `P3009` (failed migration found), `P3018`, or a SQL error.
- **Possible cause:** user lacks `CREATE DATABASE` for the shadow DB; a previous migration failed
  half-way; the SQL is invalid for existing data (e.g. new `NOT NULL` column without default);
  manual schema changes (drift).
- **Solution:**
  - Shadow DB: grant `CREATE, DROP ON *.*` locally, or set `SHADOW_DATABASE_URL` to an empty DB.
  - Failed migration in prod: fix the cause, then `npx prisma migrate resolve --rolled-back <name>`
    (or `--applied` if you completed it manually) and `migrate deploy` again — see [rollback.md](../deployment/rollback.md).
  - Data-incompatible change: split into add-nullable → backfill → make required.
  - Local drift: `npx prisma migrate reset` (**deletes local data**).
- **Verification:** `npx prisma migrate status` → "Database schema is up to date".

### Prisma client outdated

- **Symptom:** TypeScript errors like "Property 'x' does not exist on type …", runtime
  `Unknown argument`, or `Cannot find module '@/lib/generated/prisma/client'`.
- **Possible cause:** schema changed (e.g. after `git pull`) but the client wasn't regenerated;
  `lib/generated/` is gitignored.
- **Solution:** `npx prisma generate` (or `npm install`), then restart the dev server.
- **Verification:** `npm run typecheck` passes.

## SES

### Email not sending

- **Symptom:** error toast after *Send Application*; the email shows **Failed** with a message.
- **Possible cause:** see the specific entries below; also `EMAIL_TRANSPORT` not `ses`, or the
  server not restarted after editing `.env`.
- **Solution:** read the toast/`errorMessage`; check Settings → *Email (Amazon SES)*; check the
  `email.ses_failed` log line (AWS error name).
- **Verification:** sending to your own address succeeds and shows a real Message ID (not `mock-…`).

### Email address not verified

- **Symptom:** "An email address is not verified in SES…".
- **Possible cause:** sender not verified in `AWS_REGION`, or (sandbox) recipient not verified.
- **Solution:** verify the identity in the same region; in the sandbox verify the recipient or
  use `success@simulator.amazonses.com`; request production access.
- **Verification:** SES console → Identities shows **Verified**; the send succeeds.

### SES sandbox restrictions

- **Symptom:** sends to your own verified address work, sends to employers fail with "not verified";
  or throttling at 1 email/second / 200 per day.
- **Possible cause:** account still in the sandbox in this region.
- **Solution:** request production access ([aws/ses.md](../aws/ses.md#moving-out-of-the-sandbox)).
- **Verification:** SES Account dashboard shows *Production access* and a higher quota.

### AccessDenied

- **Symptom:** "The AWS credentials are not allowed to send email (ses:SendEmail)".
- **Possible cause:** no SES policy on the user/role; resource ARN scoped to the wrong
  region/identity; `ses:FromAddress` condition doesn't match `SES_FROM_EMAIL`; SCP restrictions.
- **Solution:** attach the policy from [aws/iam.md](../aws/iam.md); fix the ARN/condition.
- **Verification:** `aws sesv2 send-email …` with the same credentials succeeds.

### MessageRejected

- **Symptom:** "SES rejected the message: …".
- **Possible cause:** unverified address (most common), content rejected (e.g. virus detected in
  an attachment), invalid recipient syntax.
- **Solution:** follow the message text; check the attachment; verify identities.
- **Verification:** resend succeeds.

### Invalid credentials

- **Symptom:** "Invalid AWS credentials (access key not recognised / secret key does not match)"
  or "No AWS credentials found on the server".
- **Possible cause:** typo, extra quotes/whitespace, deleted/inactive key, key from another
  account, keys not set and no IAM role.
- **Solution:** create a new access key; paste carefully into `.env`; restart; in production
  attach an IAM role instead.
- **Verification:** Settings shows "AWS access keys present"; a test send succeeds.

### Emails stay "Sent" (never "Delivered")

See [aws/email-events.md](../aws/email-events.md#troubleshooting).

## Application

### File upload failure

- **Symptom:** "Unsupported file type", "File is larger than 5 MB", "File content does not match
  its extension", or a generic error / "Body exceeded … limit".
- **Possible cause:** wrong type, > 5 MB, renamed file, body over the 6 MB Server Action limit,
  `STORAGE_DIR` not writable, disk full.
- **Solution:** upload PDF/DOCX/DOC ≤ 5 MB; export the document again (true PDF); ensure the app
  user can write to `STORAGE_DIR`.
- **Verification:** the document appears in the list and opens via *Open*.

### "The file for X is missing from storage"

- **Cause:** the database row exists but the file was deleted or `STORAGE_DIR` changed/was not
  restored with the database.
- **Solution:** restore the storage backup or delete and re-upload the document.

### Server Action failure

- **Symptom:** toast "Something went wrong. Please try again." or "Your session has expired".
- **Possible cause:** unexpected server error (see `action.<name>.error` log), session expired,
  invalid `.env` (logs "Invalid server environment configuration: …"), or the request's Origin
  doesn't match the host behind a proxy.
- **Solution:** read the log line; sign in again; fix the env variable named in the error; behind a
  proxy forward `X-Forwarded-Host` or add the host to `experimental.serverActions.allowedOrigins`.
- **Verification:** the action succeeds and shows a success toast.

### Validation failure

- **Symptom:** red messages under fields and "Please fix the highlighted fields".
- **Possible cause:** input violates the schema (required fields, invalid emails/URLs, lengths,
  invalid status transition).
- **Solution:** correct the fields. Status lists only show allowed transitions; terminal statuses
  (Rejected/Withdrawn) cannot be changed.
- **Verification:** submission succeeds.

### Duplicate email

- **Symptom:** "This application was already emailed to … Confirm the re-send to continue.",
  "An email for this application is already being sent", or "Already sent — not sent again".
- **Possible cause:** duplicate-send protection working as designed.
- **Solution:** if you really want to send again, click **Send again** in the dialog; wait a moment
  if a send is in progress; reopen the composer for a new attempt after a failure.
- **Verification:** the details page lists the emails; only intended sends exist.

### Email stuck in "Sending"

- **Cause:** the process stopped between SES accepting the message and the database update
  (rare; log `email.post_send_update_failed` contains the Message ID).
- **Solution:** check the recipient's mailbox / SES; then update the row manually
  (`emailStatus='SENT', sesMessageId='<id>', sentAt=NOW()`), and the application status if needed.

### Login keeps failing / "Too many failed attempts"

- Wait 15 minutes or restart the server (throttling is in memory); confirm `APP_PASSWORD` in the
  running environment. Changing `SESSION_SECRET` logs everyone out.

### Wrong status set by mistake (terminal)

Terminal statuses can't be changed in the UI. Fix directly:
`UPDATE Application SET status='APPLIED' WHERE applicationId='APP-0007';` and optionally add a
note on the timeline explaining the correction.
