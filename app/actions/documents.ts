"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/run-action";
import { deleteDocument, renameDocument, setDefaultDocument, uploadDocument } from "@/lib/documents/service";
import { MAX_DOCUMENT_SIZE_BYTES, documentMetaSchema, renameDocumentSchema } from "@/lib/documents/validation";
import { AppError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation/common";

function revalidateDocuments() {
  revalidatePath("/documents");
  revalidatePath("/applications", "layout");
}

/** Multipart upload (FormData: file, name, type, isDefault). */
export async function uploadDocumentAction(formData: FormData) {
  return runAction("uploadDocument", async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to upload", { file: "File is required" });
    // Reject before buffering the whole file into memory.
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) throw new AppError("VALIDATION", "File is larger than 5 MB", { file: "Max 5 MB" });

    const parsed = documentMetaSchema.safeParse({
      name: formData.get("name") || file.name.replace(/\.[^.]+$/, ""),
      type: formData.get("type"),
      isDefault: formData.get("isDefault") === "true",
    });
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));

    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await uploadDocument({ ...parsed.data, file: { name: file.name, size: file.size, bytes } });
    revalidateDocuments();
    return {
      ok: true as const,
      data: { id: document.id, name: document.name, type: document.type },
      message: `"${document.name}" uploaded`,
    };
  });
}

export async function renameDocumentAction(values: unknown) {
  return runAction("renameDocument", async () => {
    const parsed = renameDocumentSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid name", toFieldErrors(parsed.error));
    await renameDocument(parsed.data.id, parsed.data.name);
    revalidateDocuments();
    return { ok: true as const, data: undefined, message: "Document renamed" };
  });
}

export async function setDefaultDocumentAction(id: string) {
  return runAction("setDefaultDocument", async () => {
    if (typeof id !== "string" || !id) throw new AppError("VALIDATION", "Missing document id");
    const doc = await setDefaultDocument(id);
    revalidateDocuments();
    return { ok: true as const, data: undefined, message: `"${doc.name}" is now the default` };
  });
}

export async function deleteDocumentAction(id: string) {
  return runAction("deleteDocument", async () => {
    if (typeof id !== "string" || !id) throw new AppError("VALIDATION", "Missing document id");
    await deleteDocument(id);
    revalidateDocuments();
    return { ok: true as const, data: undefined, message: "Document deleted" };
  });
}
