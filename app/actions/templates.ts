"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/run-action";
import { AppError } from "@/lib/errors";
import { templateFormSchema } from "@/lib/templates/schemas";
import { createTemplate, deleteTemplate, updateTemplate } from "@/lib/templates/service";
import { toFieldErrors } from "@/lib/validation/common";

export async function saveTemplateAction(id: string | null, values: unknown) {
  return runAction("saveTemplate", async () => {
    const parsed = templateFormSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));
    const template = id ? await updateTemplate(id, parsed.data) : await createTemplate(parsed.data);
    revalidatePath("/templates");
    return { ok: true as const, data: { id: template.id }, message: id ? "Template saved" : "Template created" };
  });
}

export async function deleteTemplateAction(id: string) {
  return runAction("deleteTemplate", async () => {
    if (typeof id !== "string" || !id) throw new AppError("VALIDATION", "Missing template id");
    await deleteTemplate(id);
    revalidatePath("/templates");
    return { ok: true as const, data: undefined, message: "Template deleted" };
  });
}
