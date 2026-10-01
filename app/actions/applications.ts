"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/run-action";
import {
  addApplicationNote,
  changeApplicationStatus,
  createApplication,
  deleteApplication,
  updateApplication,
} from "@/lib/applications/service";
import {
  applicationFormSchema,
  noteSchema,
  statusChangeSchema,
  toApplicationInput,
} from "@/lib/applications/schemas";
import { AppError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation/common";

/**
 * Application Server Actions: authenticate → validate (Zod, again on the server) →
 * call the service layer → revalidate affected pages. No business logic here.
 */

function revalidateApplications(id?: string) {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/analytics");
  if (id) revalidatePath(`/applications/${id}`);
}

export async function createApplicationAction(values: unknown) {
  return runAction("createApplication", async () => {
    const parsed = applicationFormSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));
    const application = await createApplication(toApplicationInput(parsed.data));
    revalidateApplications();
    return {
      ok: true as const,
      data: { id: application.id, applicationId: application.applicationId },
      message: `${application.applicationId} created`,
    };
  });
}

export async function updateApplicationAction(id: string, values: unknown) {
  return runAction("updateApplication", async () => {
    if (typeof id !== "string" || !id) throw new AppError("VALIDATION", "Missing application id");
    const parsed = applicationFormSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));
    const application = await updateApplication(id, toApplicationInput(parsed.data));
    revalidateApplications(id);
    return { ok: true as const, data: { id: application.id }, message: "Application updated" };
  });
}

export async function changeStatusAction(values: unknown) {
  return runAction("changeStatus", async () => {
    const parsed = statusChangeSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid status change", toFieldErrors(parsed.error));
    const result = await changeApplicationStatus(parsed.data.applicationId, parsed.data.toStatus, parsed.data.note);
    revalidateApplications(parsed.data.applicationId);
    return { ok: true as const, data: { changed: result.changed }, message: result.changed ? "Status updated" : "Status unchanged" };
  });
}

export async function addNoteAction(values: unknown) {
  return runAction("addNote", async () => {
    const parsed = noteSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid note", toFieldErrors(parsed.error));
    await addApplicationNote(parsed.data.applicationId, parsed.data.note);
    revalidatePath(`/applications/${parsed.data.applicationId}`);
    return { ok: true as const, data: undefined, message: "Note added to timeline" };
  });
}

export async function deleteApplicationAction(id: string) {
  return runAction("deleteApplication", async () => {
    if (typeof id !== "string" || !id) throw new AppError("VALIDATION", "Missing application id");
    await deleteApplication(id);
    revalidateApplications();
    return { ok: true as const, data: undefined, message: "Application deleted" };
  });
}
