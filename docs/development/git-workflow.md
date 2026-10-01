# Git Workflow

## Branches

```text
main                      always deployable; protected
 │
 ├── feature/application-crud
 ├── feature/email-ses
 ├── feature/templates
 ├── feature/analytics
 ├── fix/<short-description>
 ├── docs/<short-description>
 └── chore/<short-description>
```

| Prefix | Use |
| --- | --- |
| `feature/` | new functionality |
| `fix/` | bug fixes |
| `docs/` | documentation only |
| `refactor/` | behaviour-preserving changes |
| `test/` | tests only |
| `chore/` | tooling, dependencies, CI |
| `hotfix/` | urgent production fix branched from the release tag |

Branch from an up-to-date `main`; keep branches short-lived; rebase on `main` before opening a PR.

## Commits — Conventional Commits

```text
<type>(<scope>): <summary in imperative mood, ≤ 72 chars>

<optional body: what and why>

<optional footer: BREAKING CHANGE: …, Refs #123>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
Scopes: `applications`, `email`, `templates`, `documents`, `analytics`, `auth`, `db`, `ui`, `docs`.

Examples:

```text
feat(email): send application emails through SES with attachments
fix(applications): prevent counter deadlock on first concurrent create
docs(aws): document SES sandbox and production access
feat(db)!: rename Document.url to storageKey

BREAKING CHANGE: requires migration 2026…_rename_document_url
```

Commit schema changes together with their migration folder.

## Pull requests

Checklist (copy into the PR description):

- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] `npm test` (unit + integration) passes
- [ ] `npm run test:e2e` passes for UI/flow changes
- [ ] Migration created and reviewed (if schema changed); `docs/database/*` updated
- [ ] Relevant docs updated; [changelog.md](changelog.md) entry added
- [ ] ADR added for significant decisions
- [ ] No secrets, `.env`, uploads or generated client committed

Review focuses on: business logic placement, validation on the server, security impact, tests.
Squash-merge with a Conventional Commit title.

## Release process

1. Merge to `main` (CI green).
2. Update [changelog.md](changelog.md) and bump `version` in `package.json` (SemVer:
   `feat` → minor, `fix` → patch, breaking → major).
3. Tag: `git tag -a v1.2.0 -m "v1.2.0" && git push --tags`.
4. Deploy the tag ([deployment/production.md](../deployment/production.md)); migrations run
   before the new version starts.
5. If something breaks: [rollback.md](../deployment/rollback.md).

## What never goes into Git

`.env` / `.env.local` / any real secret · `storage/` (uploaded files) · `lib/generated/` ·
`.next/`, `node_modules/`, test reports. `.env.example` and `.env.test` (local Docker values
only) are committed on purpose.
