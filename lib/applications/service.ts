import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { formatApplicationId } from "@/lib/applications/application-id";
import { recordEvent } from "@/lib/applications/events";
import {
  buildApplicationOrderBy,
  buildApplicationWhere,
  type ApplicationQuery,
} from "@/lib/applications/query";
import type { ApplicationInput } from "@/lib/applications/schemas";
import { canTransition, getStatusLabel } from "@/lib/applications/status";

/**
 * Application business logic. All database access for applications goes through this
 * module; Server Actions and Server Components never call Prisma directly.
 * See docs/features/applications.md.
 */

const APPLICATION_COUNTER = "application";

/**
 * Makes sure the counter row exists. Runs OUTSIDE the allocating transaction: an
 * upsert inside concurrent transactions can deadlock in InnoDB (shared lock from the
 * duplicate-key check, then an exclusive lock for the update).
 */
async function ensureCounter() {
  await db.counter.createMany({ data: [{ name: APPLICATION_COUNTER, value: 0 }], skipDuplicates: true });
}

/**
 * Atomically allocates the next APP-XXXX identifier. The UPDATE takes a row lock on the
 * counter, so concurrent creations are serialised and IDs are never reused. If the
 * surrounding transaction rolls back, the number is released with it (no gaps).
 */
export async function nextApplicationId(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.update({
    where: { name: APPLICATION_COUNTER },
    data: { value: { increment: 1 } },
  });
  return formatApplicationId(counter.value);
}

async function assertDocumentsExist(tx: Prisma.TransactionClient, documentIds: string[]) {
  if (documentIds.length === 0) return;
  const count = await tx.document.count({ where: { id: { in: documentIds } } });
  if (count !== new Set(documentIds).size) {
    throw new AppError("VALIDATION", "One or more selected documents no longer exist");
  }
}

function technologiesCreate(names: string[]) {
  return names.map((name) => ({ name }));
}

export async function createApplication(input: ApplicationInput) {
  await ensureCounter();
  return db.$transaction(async (tx) => {
    await assertDocumentsExist(
      tx,
      input.documents.map((d) => d.documentId),
    );
    const applicationId = await nextApplicationId(tx);
    const application = await tx.application.create({
      data: {
        applicationId,
        company: input.company,
        position: input.position,
        dateApplied: input.dateApplied,
        location: input.location,
        jobUrl: input.jobUrl,
        source: input.source,
        status: input.status,
        notes: input.notes,
        recipientEmail: input.recipientEmail,
        cc: input.cc,
        bcc: input.bcc,
        emailSubject: input.emailSubject,
        emailBody: input.emailBody,
        techStack: { create: technologiesCreate(input.techStack) },
        documents: { create: input.documents },
        statusHistory: { create: { fromStatus: null, toStatus: input.status, note: "Initial status" } },
      },
    });
    await recordEvent(tx, application.id, "APPLICATION_CREATED", `Application ${applicationId} created`, {
      status: input.status,
    });
    return application;
  });
}

const TRACKED_FIELDS = [
  "company",
  "position",
  "location",
  "jobUrl",
  "source",
  "notes",
  "recipientEmail",
  "cc",
  "bcc",
  "emailSubject",
  "emailBody",
] as const;

export async function updateApplication(id: string, input: ApplicationInput) {
  return db.$transaction(async (tx) => {
    const existing = await tx.application.findUnique({
      where: { id },
      include: { techStack: true, documents: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Application not found");
    await assertDocumentsExist(
      tx,
      input.documents.map((d) => d.documentId),
    );

    const statusChanged = existing.status !== input.status;
    if (statusChanged && !canTransition(existing.status, input.status)) {
      throw new AppError(
        "INVALID_TRANSITION",
        `Cannot change status from ${getStatusLabel(existing.status)} to ${getStatusLabel(input.status)}`,
        { status: "This status change is not allowed" },
      );
    }

    const changed: string[] = TRACKED_FIELDS.filter((f) => (existing[f] ?? null) !== (input[f] ?? null));
    if ((existing.dateApplied?.getTime() ?? null) !== (input.dateApplied?.getTime() ?? null)) changed.push("dateApplied");
    const oldTech = existing.techStack.map((t) => t.name).sort().join("|");
    const techChanged = oldTech !== [...input.techStack].sort().join("|");
    if (techChanged) changed.push("techStack");
    const docKey = (d: { documentId: string; role: string }) => `${d.documentId}:${d.role}`;
    const docsChanged =
      existing.documents.map(docKey).sort().join("|") !== input.documents.map(docKey).sort().join("|");

    const application = await tx.application.update({
      where: { id },
      data: {
        company: input.company,
        position: input.position,
        dateApplied: input.dateApplied,
        location: input.location,
        jobUrl: input.jobUrl,
        source: input.source,
        status: input.status,
        notes: input.notes,
        recipientEmail: input.recipientEmail,
        cc: input.cc,
        bcc: input.bcc,
        emailSubject: input.emailSubject,
        emailBody: input.emailBody,
        ...(techChanged ? { techStack: { deleteMany: {}, create: technologiesCreate(input.techStack) } } : {}),
        ...(docsChanged ? { documents: { deleteMany: {}, create: input.documents } } : {}),
      },
    });

    if (changed.length > 0) {
      await recordEvent(tx, id, "APPLICATION_UPDATED", `Updated ${changed.join(", ")}`, { fields: changed });
    }
    if (docsChanged) {
      await recordEvent(tx, id, "DOCUMENTS_UPDATED", "Attached documents updated", {
        documents: input.documents,
      });
    }
    if (statusChanged) {
      await tx.statusHistory.create({
        data: { applicationId: id, fromStatus: existing.status, toStatus: input.status },
      });
      await recordEvent(tx, id, "STATUS_CHANGED", `Status changed to ${getStatusLabel(input.status)}`, {
        from: existing.status,
        to: input.status,
      });
    }
    return application;
  });
}

/**
 * Changes status with lifecycle validation, writing StatusHistory + a timeline event.
 * Accepts an optional transaction so the email-send flow can reuse it.
 */
export async function changeApplicationStatus(
  id: string,
  toStatus: ApplicationStatus,
  note?: string | null,
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    const existing = await client.application.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new AppError("NOT_FOUND", "Application not found");
    if (existing.status === toStatus) return { changed: false as const };
    if (!canTransition(existing.status, toStatus)) {
      throw new AppError(
        "INVALID_TRANSITION",
        `Cannot change status from ${getStatusLabel(existing.status)} to ${getStatusLabel(toStatus)}`,
      );
    }
    await client.application.update({ where: { id }, data: { status: toStatus } });
    await client.statusHistory.create({
      data: { applicationId: id, fromStatus: existing.status, toStatus, note: note || null },
    });
    await recordEvent(
      client,
      id,
      "STATUS_CHANGED",
      `Status changed to ${getStatusLabel(toStatus)}${note ? ` — ${note}` : ""}`,
      { from: existing.status, to: toStatus },
    );
    return { changed: true as const, from: existing.status, to: toStatus };
  };
  return tx ? run(tx) : db.$transaction(run);
}

export async function addApplicationNote(id: string, note: string) {
  return db.$transaction(async (tx) => {
    const exists = await tx.application.count({ where: { id } });
    if (!exists) throw new AppError("NOT_FOUND", "Application not found");
    return recordEvent(tx, id, "NOTE", note);
  });
}

export async function deleteApplication(id: string) {
  const exists = await db.application.count({ where: { id } });
  if (!exists) throw new AppError("NOT_FOUND", "Application not found");
  // Emails, events, history, technologies and document links cascade (see schema).
  await db.application.delete({ where: { id } });
}

export async function getApplication(id: string) {
  return db.application.findUnique({
    where: { id },
    include: {
      techStack: { orderBy: { name: "asc" } },
      documents: { include: { document: true }, orderBy: { createdAt: "asc" } },
      emails: { include: { attachments: true }, orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type ApplicationDetails = NonNullable<Awaited<ReturnType<typeof getApplication>>>;

export async function listApplications(query: ApplicationQuery) {
  const where = buildApplicationWhere(query);
  const [total, items] = await db.$transaction([
    db.application.count({ where }),
    db.application.findMany({
      where,
      orderBy: buildApplicationOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        techStack: { orderBy: { name: "asc" }, select: { name: true } },
        emails: { orderBy: { createdAt: "desc" }, take: 1, select: { emailStatus: true } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  return { items, total, page: query.page, pageSize: query.pageSize, pageCount };
}

export type ApplicationListItem = Awaited<ReturnType<typeof listApplications>>["items"][number];

/** Distinct values used to populate filter dropdowns. */
export async function getApplicationFilterOptions() {
  const [locations, companies] = await Promise.all([
    db.application.findMany({
      where: { location: { not: null } },
      distinct: ["location"],
      select: { location: true },
      orderBy: { location: "asc" },
      take: 200,
    }),
    db.application.findMany({
      distinct: ["company"],
      select: { company: true },
      orderBy: { company: "asc" },
      take: 500,
    }),
  ]);
  return {
    locations: locations.map((l) => l.location).filter((l): l is string => Boolean(l)),
    companies: companies.map((c) => c.company),
  };
}
