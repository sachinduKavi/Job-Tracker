import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { logger } from "@/lib/logger";
import { getObject, putObject, removeObject } from "@/lib/storage/local";
import { sanitizeFilename, validateDocumentFile } from "@/lib/documents/validation";

/**
 * Document library: CVs, cover letters and other files.
 * Business rules:
 *  - Content is validated by magic bytes, size-limited (5 MB) and stored under a random key.
 *  - At most one default document per type; setting a new default clears the old one
 *    inside the same transaction.
 * See docs/features/documents.md.
 */

export interface UploadDocumentInput {
  name: string;
  type: DocumentType;
  isDefault: boolean;
  file: { name: string; size: number; bytes: Uint8Array };
}

export async function uploadDocument(input: UploadDocumentInput) {
  const check = validateDocumentFile(input.file);
  if (!check.ok) throw new AppError("VALIDATION", check.error, { file: check.error });

  const storageKey = await putObject(input.file.bytes, check.extension);
  try {
    return await db.$transaction(async (tx) => {
      const hasDefault = await tx.document.count({ where: { type: input.type, isDefault: true } });
      // The first document of a type becomes the default automatically.
      const isDefault = input.isDefault || hasDefault === 0;
      if (isDefault) await tx.document.updateMany({ where: { type: input.type }, data: { isDefault: false } });
      return tx.document.create({
        data: {
          name: input.name,
          type: input.type,
          storageKey,
          originalFilename: sanitizeFilename(input.file.name),
          mimeType: check.type.mimeType,
          size: input.file.size,
          isDefault,
        },
      });
    });
  } catch (error) {
    // Don't leave orphaned files when the database write fails.
    await removeObject(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function renameDocument(id: string, name: string) {
  const exists = await db.document.count({ where: { id } });
  if (!exists) throw new AppError("NOT_FOUND", "Document not found");
  return db.document.update({ where: { id }, data: { name } });
}

export async function setDefaultDocument(id: string) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) throw new AppError("NOT_FOUND", "Document not found");
    await tx.document.updateMany({ where: { type: doc.type }, data: { isDefault: false } });
    return tx.document.update({ where: { id }, data: { isDefault: true } });
  });
}

export async function deleteDocument(id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found");
  await db.$transaction(async (tx) => {
    // Application links cascade; email attachment snapshots keep filename/size (documentId → NULL).
    await tx.document.delete({ where: { id } });
    if (doc.isDefault) {
      const next = await tx.document.findFirst({ where: { type: doc.type }, orderBy: { createdAt: "desc" } });
      if (next) await tx.document.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  await removeObject(doc.storageKey).catch((error) => logger.warn("document.file_remove_failed", { id, error: String(error) }));
}

export async function listDocuments(type?: DocumentType) {
  return db.document.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ type: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { applications: true } } },
  });
}

export type DocumentListItem = Awaited<ReturnType<typeof listDocuments>>[number];

export async function getDocument(id: string) {
  return db.document.findUnique({ where: { id } });
}

/** Loads document metadata + bytes (used by the download route and email attachments). */
export async function getDocumentWithContent(id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found");
  try {
    const content = await getObject(doc.storageKey);
    return { document: doc, content };
  } catch (error) {
    logger.error("document.file_missing", { id, error: String(error) });
    throw new AppError("NOT_FOUND", `The file for "${doc.name}" is missing from storage`);
  }
}
