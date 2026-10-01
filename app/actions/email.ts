"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/run-action";
import { getEmailStatusLabel } from "@/lib/email/delivery-status";
import { composeEmailSchema } from "@/lib/email/schemas";
import { sendEmailForApplication } from "@/lib/email/service";
import { AppError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation/common";

/** Sends an application email after the user confirmed it in the composer dialog. */
export async function sendEmailAction(values: unknown) {
  return runAction("sendEmail", async () => {
    const parsed = composeEmailSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));
    const { email, duplicate } = await sendEmailForApplication(parsed.data);
    revalidatePath("/");
    revalidatePath("/applications");
    revalidatePath(`/applications/${parsed.data.applicationId}`);
    revalidatePath("/analytics");
    return {
      ok: true as const,
      data: { emailId: email.id, sesMessageId: email.sesMessageId, status: email.emailStatus },
      message: duplicate
        ? `Already sent (${getEmailStatusLabel(email.emailStatus)}) — not sent again`
        : "Application email sent",
    };
  });
}
