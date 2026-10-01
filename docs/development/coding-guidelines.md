# Coding Guidelines

## Principles

1. **No business logic in UI components.** Components render and collect input; rules,
   transactions and side effects live in `lib/`.
2. **Database access only in services** (`lib/**/service.ts`, `lib/email/delivery-events.ts`).
   Pages and actions call services; components never import `lib/db`.
3. **AWS only in `lib/email/ses.ts`.** Storage only in `lib/storage/`.
4. **Validate on both sides.** Zod schema in `lib/**/schemas.ts`, used by `zodResolver` in the
   form and `safeParse` in the action.
5. **Explicit errors.** Throw `AppError(code, message, fieldErrors?)` for expected failures;
   let unexpected errors propagate to `runAction` (logged, generic message).
6. **No scattered magic strings.** Statuses, sources, delivery statuses, document types and
   their labels come from their config modules.
7. **Prefer simple code.** No abstraction until there is a second real use; no new
   dependencies without a reason in the PR.

## TypeScript

- `strict: true`; no `any` (use `unknown` + narrowing).
- Generated Prisma types are the source of truth for persisted shapes; import enums from
  `@/lib/generated/prisma/enums` in shared code (safe for the browser) and the client from
  `@/lib/generated/prisma/client` only on the server.
- Use the Next.js generated helpers: `PageProps<'/route'>`, `LayoutProps<'/'>`,
  `RouteContext<'/api/...'>` (`npm run typecheck` regenerates them).

## Server / client boundary

- Server-only modules start with `import "server-only";`.
- Client components start with `"use client"` and import only pure modules and Server Actions.
- Server Actions live in `app/actions/*.ts` with `"use server"` and follow:

  ```ts
  export async function doThingAction(values: unknown) {
    return runAction("doThing", async () => {
      const parsed = schema.safeParse(values);
      if (!parsed.success) throw new AppError("VALIDATION", "…", toFieldErrors(parsed.error));
      const result = await service(parsed.data);
      revalidatePath("/affected");
      return { ok: true as const, data: result, message: "Done" };
    });
  }
  ```

## Next.js 16 conventions

- Read `node_modules/next/dist/docs/` before using an API — this version differs from older
  training material (see `AGENTS.md`).
- `params` and `searchParams` are Promises — `await` them.
- `proxy.ts`, not `middleware.ts`.
- Mutations use Server Actions; Route Handlers only for real HTTP endpoints (webhooks, downloads, health).

## UI

- shadcn/ui primitives in `components/ui/` are generated — customise via props/classes, not
  by adding logic there. Add new ones with `npx shadcn@latest add <name>`.
- Every async action shows a pending state, a success toast and an error toast.
- Destructive actions use `AlertDialog`; sending email always uses the confirmation dialog.
- Provide empty, loading (`loading.tsx` / skeletons) and error states.
- Use semantic tokens (`bg-card`, `text-muted-foreground`, …) so dark mode works.
- Charts: follow [analytics.md](../features/analytics.md#chart-design-decisions).

## Naming & files

- Files: `kebab-case.ts(x)`; components `PascalCase`; functions `camelCase`; constants `UPPER_SNAKE`.
- Actions end with `Action`; services are verbs (`createApplication`, `listDocuments`).
- One feature per folder in `lib/` and `components/`.

## Comments & docs

- Module header comment explaining the *why* and linking the relevant doc.
- Update docs in the same PR as the code ([docs/README.md](../README.md#documentation-rules)).

## Tooling

```bash
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm run typecheck   # next typegen && tsc --noEmit
npm test            # unit + integration
npm run test:e2e
```
