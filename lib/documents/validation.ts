import { z } from "zod";
import { DocumentType } from "@/lib/generated/prisma/enums";
import { requiredText } from "@/lib/validation/common";

/**
 * Document upload rules (pure, unit-tested). The server never trusts the browser's
 * MIME type or file extension alone: the file's magic bytes must match an allowed type.
 * See docs/features/documents.md.
 */

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DOCUMENT_SIZE_LABEL = "5 MB";

export interface AllowedFileType {
  mimeType: string;
  extensions: string[];
  label: string;
  /** Leading bytes that identify the format. */
  magic: number[];
}

export const ALLOWED_FILE_TYPES: AllowedFileType[] = [
  { mimeType: "application/pdf", extensions: [".pdf"], label: "PDF", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    label: "Word (.docx)",
    magic: [0x50, 0x4b, 0x03, 0x04], // ZIP container
  },
  {
    mimeType: "application/msword",
    extensions: [".doc"],
    label: "Word 97-2003 (.doc)",
    magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE2
  },
];

export const ACCEPT_ATTRIBUTE = ALLOWED_FILE_TYPES.flatMap((t) => [t.mimeType, ...t.extensions]).join(",");

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CV: "CV / Résumé",
  COVER_LETTER: "Cover Letter",
  OTHER: "Other",
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

/** Strips path components and unsafe characters; keeps the extension. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ()]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 150);
  return cleaned || "file";
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

export type FileValidationResult =
  | { ok: true; type: AllowedFileType; extension: string }
  | { ok: false; error: string };

export function validateDocumentFile(file: { name: string; size: number; bytes: Uint8Array }): FileValidationResult {
  if (file.size === 0) return { ok: false, error: "The file is empty" };
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return { ok: false, error: `File is larger than ${MAX_DOCUMENT_SIZE_LABEL}` };
  const extension = getExtension(file.name);
  const type = ALLOWED_FILE_TYPES.find((t) => t.extensions.includes(extension));
  if (!type) {
    return { ok: false, error: `Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES.map((t) => t.label).join(", ")}` };
  }
  if (!startsWith(file.bytes, type.magic)) {
    return { ok: false, error: "File content does not match its extension" };
  }
  return { ok: true, type, extension };
}

export const documentMetaSchema = z.object({
  name: requiredText("Name", 200),
  type: z.enum(DocumentType),
  isDefault: z.boolean(),
});

export const renameDocumentSchema = z.object({
  id: z.string().min(1).max(50),
  name: requiredText("Name", 200),
});

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
